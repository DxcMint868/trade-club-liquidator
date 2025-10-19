import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { Delegation } from "@prisma/client";

@Injectable()
export class DelegationService {
  constructor(
    private db: DatabaseService,
    private contractService: ContractService
  ) {}

  // Event handlers
  @OnEvent("delegation.created")
  async handleDelegationCreated(payload: any) {
    const {
      delegationHash,
      supporter,
      monachad,
      matchId,
      amount,
      spendingLimit,
      expiresAt,
      blockNumber,
      transactionHash,
    } = payload;

    await this.db.delegation.create({
      data: {
        delegationHash,
        supporter: supporter.toLowerCase(),
        monachad: monachad.toLowerCase(),
        matchId,
        amount,
        spendingLimit,
        expiresAt: new Date(parseInt(expiresAt) * 1000),
        blockNumber,
        transactionHash,
        isActive: true,
        createdTxHash: transactionHash,
      },
    });

    console.log(`✅ Delegation ${delegationHash} created`);
  }

  @OnEvent("delegation.revoked")
  async handleDelegationRevoked(payload: any) {
    const { delegationHash, transactionHash } = payload;

    await this.db.delegation.update({
      where: { delegationHash },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedTxHash: transactionHash,
      },
    });

    console.log(`✅ Delegation ${delegationHash} revoked`);
  }

  @OnEvent("delegation.executed")
  async handleDelegationExecuted(payload: any) {
    const { delegationHash, target, value } = payload;

    // Update spent amount
    const delegation = await this.db.delegation.findUnique({
      where: { delegationHash },
    });

    if (delegation) {
      const newSpentAmount = BigInt(delegation.spentAmount) + BigInt(value);

      await this.db.delegation.update({
        where: { delegationHash },
        data: {
          spentAmount: newSpentAmount.toString(),
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Delegation ${delegationHash} executed. Spent: ${value}`);
    }
  }

  // API methods
  async getDelegation(delegationHash: string) {
    const delegation = await this.db.delegation.findUnique({
      where: { delegationHash },
    });

    if (!delegation) {
      throw new Error(`Delegation ${delegationHash} not found`);
    }

    // Check if expired
    const now = new Date();
    if (delegation.expiresAt < now && delegation.isActive) {
      await this.db.delegation.update({
        where: { delegationHash },
        data: { isActive: false },
      });
      delegation.isActive = false;
    }

    return delegation;
  }

  async getUserDelegations(address: string) {
    const lowerAddress = address.toLowerCase();

    return await this.db.delegation.findMany({
      where: {
        OR: [{ supporter: lowerAddress }, { monachad: lowerAddress }],
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getActiveDelegationsForMonachad(monachad: string) {
    const now = new Date();

    return await this.db.delegation.findMany({
      where: {
        monachad: monachad.toLowerCase(),
        isActive: true,
        expiresAt: {
          gte: now,
        },
      },
    });
  }

  async getDelegationsByMatch(matchId: string) {
    return await this.db.delegation.findMany({
      where: { matchId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getMonachadSupporters(monachad: string) {
    const delegations = await this.db.delegation.findMany({
      where: {
        monachad: monachad.toLowerCase(),
        isActive: true,
      },
    });

    // Group by supporter
    const supportersMap = new Map();
    for (const delegation of delegations) {
      const supporter = delegation.supporter;
      if (!supportersMap.has(supporter)) {
        supportersMap.set(supporter, {
          supporter,
          totalDelegated: BigInt(0),
          activeDelegations: 0,
        });
      }

      const data = supportersMap.get(supporter);
      data.totalDelegated += BigInt(delegation.amount);
      data.activeDelegations += 1;
      supportersMap.set(supporter, data);
    }

    return Array.from(supportersMap.values()).map((s) => ({
      ...s,
      totalDelegated: s.totalDelegated.toString(),
    }));
  }

  async isDelegationValidAndNotExpired(
    delegation: Delegation
  ): Promise<boolean> {
    if (!delegation) return false;

    const isBytes32Hash = /^0x[a-f0-9]{64}$/i.test(delegation.delegationHash); // Ensure we only hit the chain when we have a proper bytes32 hash

    // Check on-chain with the delegator (supporter) address when hash is valid bytes32
    const isValidOnChain = isBytes32Hash
      ? await this.contractService.isDelegationValid(
          delegation.delegationHash,
          delegation.supporter // The supporter is the delegator
        )
      : true;

    if (!isValidOnChain) {
      // Update DB if not valid on-chain
      await this.db.delegation.update({
        where: { delegationHash: delegation.delegationHash },
        data: { isActive: false },
      });
      return false;
    }

    const now = new Date();
    const isExpired = delegation.expiresAt < now;

    if (isExpired && delegation.isActive) {
      await this.db.delegation.update({
        where: { delegationHash: delegation.delegationHash },
        data: { isActive: false },
      });
      return false;
    }

    return delegation.isActive && !isExpired;
  }

  async getDelegationStats(address: string) {
    const lowerAddress = address.toLowerCase();

    const asSupporterActive = await this.db.delegation.count({
      where: {
        supporter: lowerAddress,
        isActive: true,
      },
    });

    const asMonachadActive = await this.db.delegation.count({
      where: {
        monachad: lowerAddress,
        isActive: true,
      },
    });

    // Fetch delegations as supporter and sum manually
    const delegatedDelegations = await this.db.delegation.findMany({
      where: {
        supporter: lowerAddress,
        isActive: true,
      },
      select: {
        amount: true,
      },
    });

    // Fetch delegations as monachad and sum manually
    const receivedDelegations = await this.db.delegation.findMany({
      where: {
        monachad: lowerAddress,
        isActive: true,
      },
      select: {
        amount: true,
      },
    });

    // TODO: optimize with raw SQL
    // Sum amounts manually using BigInt
    const totalDelegatedAmount = delegatedDelegations.reduce(
      (sum, d) => sum + BigInt(d.amount),
      BigInt(0)
    );

    const totalReceivedAmount = receivedDelegations.reduce(
      (sum, d) => sum + BigInt(d.amount),
      BigInt(0)
    );

    return {
      address,
      asSupporterActive,
      asMonachadActive,
      totalDelegatedAmount: totalDelegatedAmount.toString(),
      totalReceivedAmount: totalReceivedAmount.toString(),
    };
  }
}
