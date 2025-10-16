import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { DelegationService } from "../delegation/delegation.service";
import { TradingService } from "./trading.service";
import { TradeType } from "@prisma/client";

interface CopyTradeParams {
  monachadAddress: string;
  matchId: string;
  originalTrade: {
    target: string;
    value: string;
    data: string;
  };
}

@Injectable()
export class CopyEngineService {
  private readonly logger = new Logger(CopyEngineService.name);

  constructor(
    private db: DatabaseService,
    private contractService: ContractService,
    private delegationService: DelegationService,
    private tradingService: TradingService,
  ) {}

  /**
   * Execute pro rata copy trades for all active supporters
   */
  async executeCopyTrades(params: CopyTradeParams): Promise<void> {
    const { monachadAddress, matchId, originalTrade } = params;

    // Get all active delegations for this Monachad in this match
    const activeDelegations = await this.db.delegation.findMany({
      where: {
        monachad: monachadAddress.toLowerCase(),
        matchId,
        isActive: true,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (activeDelegations.length === 0) {
      this.logger.log(
        `No active delegations for Monachad ${monachadAddress} in match ${matchId}`,
      );
      return;
    }

    this.logger.log(
      `Executing ${activeDelegations.length} copy trades for Monachad ${monachadAddress}`,
    );

    // Calculate proportions
    let totalDelegatedAmount = BigInt(0);
    for (const delegation of activeDelegations) {
      totalDelegatedAmount += BigInt(delegation.amount);
    }

    const originalTradeValue = BigInt(originalTrade.value);

    // Execute copy trades for each supporter
    for (const delegation of activeDelegations) {
      try {
        await this.executeSingleCopyTrade(
          delegation,
          originalTrade,
          originalTradeValue,
          totalDelegatedAmount,
          matchId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute copy trade for delegation ${delegation.delegationHash}: ${error.message}`,
        );
      }
    }
  }

  private async executeSingleCopyTrade(
    delegation: any,
    originalTrade: any,
    originalTradeValue: bigint,
    totalDelegatedAmount: bigint,
    matchId: string,
  ): Promise<void> {
    const { delegationHash, supporter, amount } = delegation;

    // Calculate proportional trade size
    const delegationAmount = BigInt(amount);
    const proportionalValue =
      (originalTradeValue * delegationAmount) / totalDelegatedAmount;

    // Validate delegation is still valid on-chain
    const isValid =
      await this.delegationService.isValidDelegation(delegationHash);
    if (!isValid) {
      this.logger.warn(`Delegation ${delegationHash} is no longer valid`);
      return;
    }

    // Check spending limits
    const spentAmount = BigInt(delegation.spentAmount);
    const maxSpend = BigInt(amount); // Assuming amount is the spending limit

    if (spentAmount + proportionalValue > maxSpend) {
      this.logger.warn(
        `Delegation ${delegationHash} would exceed spending limit. Skipping.`,
      );
      return;
    }

    try {
      // Execute delegated trade on-chain
      const receipt = await this.contractService.executeDelegatedTrade(
        delegationHash,
        originalTrade.target,
        proportionalValue,
        originalTrade.data,
      );

      // Find or create participant record for supporter
      let participant = await this.db.participant.findUnique({
        where: {
          matchId_address: {
            matchId,
            address: supporter.toLowerCase(),
          },
        },
      });

      if (!participant) {
        // Create participant record for supporter (delegated participation)
        participant = await this.db.participant.create({
          data: {
            matchId,
            address: supporter.toLowerCase(),
            stakedAmount: delegation.amount, // Delegated amount acts as stake
            pnl: "0",
          },
        });
        this.logger.log(
          `Created participant record for supporter ${supporter}`,
        );
      }

      // Record copy trade
      await this.tradingService.recordTrade(
        {
          matchId,
          participantId: participant.id,
          delegationId: delegation.id,
          tradeType: TradeType.SUPPORTER_COPY,
          tokenIn: originalTrade.tokenIn || "",
          tokenOut: originalTrade.tokenOut || "",
          amountIn: proportionalValue.toString(),
          amountOut: "0", // TODO: Calculate based on actual trade result
          targetContract: originalTrade.target || "",
        },
        receipt.blockNumber,
        receipt.hash,
      );

      this.logger.log(
        `✅ Copy trade executed for ${supporter}: ${this.contractService.formatEther(proportionalValue)} ETH`,
      );
    } catch (error) {
      this.logger.error(`Failed to execute copy trade: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get copy trading statistics for a Monachad
   */
  async getCopyTradingStats(monachad: string, matchId?: string) {
    const where: any = {
      monachad: monachad.toLowerCase(),
      isActive: true,
    };

    if (matchId) {
      where.matchId = matchId;
    }

    const delegations = await this.db.delegation.findMany({ where });

    let totalSupporters = delegations.length;
    let totalDelegatedAmount = BigInt(0);
    let totalSpentAmount = BigInt(0);

    for (const delegation of delegations) {
      totalDelegatedAmount += BigInt(delegation.amount);
      totalSpentAmount += BigInt(delegation.spentAmount);
    }

    // Get copy trades count
    const copyTrades = await this.db.trade.count({
      where: {
        matchId,
        tradeType: TradeType.SUPPORTER_COPY,
      },
    });

    return {
      monachad,
      matchId: matchId || "all",
      totalSupporters,
      totalDelegatedAmount: totalDelegatedAmount.toString(),
      totalSpentAmount: totalSpentAmount.toString(),
      remainingAmount: (totalDelegatedAmount - totalSpentAmount).toString(),
      copyTradesExecuted: copyTrades,
      utilizationRate:
        totalDelegatedAmount > 0n
          ? Number((totalSpentAmount * 10000n) / totalDelegatedAmount) / 100
          : 0,
    };
  }

  /**
   * Get supporter's copy trading performance
   */
  async getCopyTradeStats(supporter: string, matchId?: string) {
    const where: any = {
      participant: {
        address: supporter.toLowerCase(),
      },
      tradeType: TradeType.SUPPORTER_COPY,
    };

    if (matchId) {
      where.matchId = matchId;
    }

    const copyTrades = await this.db.trade.findMany({
      where,
      include: {
        participant: true,
      },
    });

    let totalCopyTrades = copyTrades.length;
    let totalVolume = BigInt(0);
    let totalPnL = BigInt(0);

    for (const trade of copyTrades) {
      // Calculate volume from amountIn
      totalVolume += BigInt(trade.amountIn);
      // Get PnL from participant
      if (trade.participant) {
        totalPnL += BigInt(trade.participant.pnl);
      }
    }

    return {
      supporter,
      matchId: matchId || "all",
      totalCopyTrades,
      totalVolume: totalVolume.toString(),
      totalPnL: totalPnL.toString(),
      avgPnLPerTrade:
        totalCopyTrades > 0
          ? (totalPnL / BigInt(totalCopyTrades)).toString()
          : "0",
    };
  }
}
