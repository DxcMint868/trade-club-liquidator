import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { DelegationService } from "../delegation/delegation.service";
import { TradingService } from "./trading.service";
import { ParticipantRole, TradeType } from "@prisma/client";
import { createPublicClient, http, type Hex } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import {
  createExecution,
  ExecutionMode,
  type Delegation,
} from "@metamask/delegation-toolkit";
import { Delegation as DelegationInDb } from "@prisma/client";

// DelegationManager contract - loaded dynamically at runtime
let DelegationManagerContract: any;

interface CopyTradeParams {
  monachadAddress: string;
  matchId: string;
  originalTrade: {
    target: string;
    value: string;
    data: string;
  };
  metadata?: {
    sizeToPortfolioBps?: string;
    [key: string]: any;
  };
}

/**
 * Signed delegation from user (delegator)
 * This is what we receive from the frontend after user signs
 */
interface SignedDelegation extends Delegation {
  signature: Hex;
}

/**
 * Batch of copy trades to execute together
 */
interface BatchCopyTrade {
  delegation: SignedDelegation;
  delegationRecord: any; // DB record
  target: string;
  value: bigint;
  data: string;
}

@Injectable()
export class CopyEngineService {
  private readonly logger = new Logger(CopyEngineService.name);
  private readonly bundlerUrl: string;
  private readonly entryPointAddress: string;
  private readonly rpcUrl: string;
  private readonly publicClient: any;
  private readonly bundlerClient: any;

  constructor(
    private db: DatabaseService,
    private contractService: ContractService,
    private delegationService: DelegationService,
    private tradingService: TradingService,
    private configService: ConfigService
  ) {
    this.rpcUrl = this.configService.get<string>(
      "RPC_URL",
      "https://testnet.monad.xyz"
    );

    this.bundlerUrl = this.configService.get<string>(
      "BUNDLER_URL",
      "https://api.pimlico.io/v1/monad-testnet/rpc"
    );

    this.entryPointAddress = this.configService.get<string>(
      "ENTRYPOINT_ADDRESS",
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    );

    // Initialize Viem clients for MetaMask Delegation Toolkit
    this.publicClient = createPublicClient({
      transport: http(this.rpcUrl),
    });

    this.bundlerClient = createBundlerClient({
      client: this.publicClient,
      transport: http(this.bundlerUrl),
    });
  }

  /**
   * Execute pro rata copy trades for all active supporters using BATCH PROCESSING
   * This submits multiple delegated trades in a single bundler call (like multicall)
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
        `No active delegations for Monachad ${monachadAddress} in match ${matchId}`
      );
      return;
    }

    this.logger.log(
      `Preparing batch of ${activeDelegations.length} copy trades for Monachad ${monachadAddress}`
    );

    // Calculate proportions
    let totalDelegatedAmount = BigInt(0);
    for (const delegation of activeDelegations) {
      totalDelegatedAmount += BigInt(delegation.amount);
    }

    const originalTradeValue = BigInt(originalTrade.value);
    const sizeToPortfolioBps = params.metadata?.sizeToPortfolioBps
      ? BigInt(params.metadata.sizeToPortfolioBps)
      : null;

    if (!sizeToPortfolioBps) {
      this.logger.error(
        "executeCopyTrades: sizeToPortfolioBps missing from metadata, aboring copy trade"
      );
      return;
    }

    // Prepare batch of trades
    const batchTrades: BatchCopyTrade[] = [];

    for (const delegation of activeDelegations) {
      try {
        // Calculate proportional trade size
        const delegationAmount = BigInt(delegation.amount);
        const proportionalValue: bigint =
          (delegationAmount * sizeToPortfolioBps) / 10000n;

        // Validate delegation is still valid on-chain
        const isValid =
          await this.delegationService.isDelegationValidAndNotExpired(
            delegation
          );

        if (!isValid) {
          this.logger.warn(
            `Delegation ${delegation.delegationHash} is no longer valid, skipping`
          );
          continue;
        }

        // Check spending limits
        const spentAmount = BigInt(delegation.spentAmount);
        const maxSpend = BigInt(delegation.amount);

        if (spentAmount + proportionalValue > maxSpend) {
          this.logger.warn(
            `Delegation ${delegation.delegationHash} would exceed spending limit, skipping`
          );
          continue;
        }

        // Retrieve the signed delegation from database (stored when user created it)
        const signedDelegation = await this.getSignedDelegation(delegation);

        if (!signedDelegation) {
          this.logger.error(
            `No signed delegation found for ${delegation.delegationHash}`
          );
          continue;
        }

        batchTrades.push({
          delegation: signedDelegation,
          delegationRecord: delegation,
          target: originalTrade.target,
          value: proportionalValue,
          data: originalTrade.data,
        });
      } catch (error) {
        this.logger.error(
          `Failed to prepare delegation ${delegation.delegationHash}: ${error.message}`
        );
      }
    }

    if (batchTrades.length === 0) {
      this.logger.warn("No valid delegations to execute in batch");
      return;
    }

    // Execute batch with bundler
    await this.executeBatchCopyTrades(batchTrades, matchId);
  }

  /**
   * Execute batch of copy trades using MetaMask Delegation Toolkit
   * Submits multiple UserOps at once
   */
  private async executeBatchCopyTrades(
    batchTrades: BatchCopyTrade[],
    matchId: string
  ): Promise<void> {
    this.logger.log(`Executing batch of ${batchTrades.length} copy trades`);

    try {
      // Prepare all delegations and executions for batch submission
      const delegations: SignedDelegation[][] = [];
      const modes: ExecutionMode[] = [];
      const executions: any[] = [];

      for (const trade of batchTrades) {
        // Each trade gets its own delegation chain (single delegation for now)
        delegations.push([trade.delegation]);

        // SingleDefault execution mode
        modes.push(ExecutionMode.SingleDefault);

        // Create execution for this trade
        executions.push(
          createExecution({
            target: trade.target as Hex,
            value: trade.value,
            callData: trade.data as Hex,
          })
        );
      }

      // Build the redeemDelegations calldata using MetaMask toolkit
      // Lazy load DelegationManager if not already loaded
      if (!DelegationManagerContract) {
        try {
          // Use require() to bypass TypeScript module resolution issues
          DelegationManagerContract =
            require("@metamask/delegation-toolkit/contracts").DelegationManager;
        } catch (error) {
          this.logger.error(
            "Failed to load DelegationManager from toolkit",
            error
          );
          throw new Error("MetaMask Delegation Toolkit not available");
        }
      }

      const redeemDelegationCalldata =
        DelegationManagerContract.encode.redeemDelegations({
          delegations,
          modes,
          executions,
        });

      // Get the DeleGator address from first trade (they all redeem through same DelegationManager)
      const delegationManagerAddress = this.configService.get<string>(
        "DELEGATION_MANAGER_ADDRESS"
      ) as Hex;

      // Submit as a single bundler transaction
      // The bundler will process all redemptions atomically
      const userOpHash = await this.bundlerClient.sendUserOperation({
        calls: [
          {
            to: delegationManagerAddress,
            data: redeemDelegationCalldata,
          },
        ],
        maxFeePerGas: BigInt(2000000000), // 2 gwei
        maxPriorityFeePerGas: BigInt(1000000000), // 1 gwei
      });

      this.logger.log(`Batch UserOperation submitted: ${userOpHash}`);

      // Wait for bundler to include the batch
      const receipt = await this.bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      if (!receipt.success) {
        throw new Error(`Batch UserOperation failed: ${userOpHash}`);
      }

      this.logger.log(
        `Batch executed in block ${receipt.receipt.blockNumber}, txHash: ${receipt.receipt.transactionHash}`
      );

      // Update database records for all successful trades
      await this.recordBatchTrades(
        batchTrades,
        matchId,
        receipt.receipt.blockNumber,
        receipt.receipt.transactionHash
      );
    } catch (error) {
      this.logger.error(`Batch execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record all batch trades in database
   */
  private async recordBatchTrades(
    batchTrades: BatchCopyTrade[],
    matchId: string,
    blockNumber: number,
    txHash: string
  ): Promise<void> {
    for (const trade of batchTrades) {
      try {
        const delegation = trade.delegationRecord;
        const supporter = delegation.supporter;

        // Find or create participant record
        let participant = await this.db.participant.findUnique({
          where: {
            matchId_address: {
              matchId,
              address: supporter.toLowerCase(),
            },
          },
        });

        if (!participant) {
          participant = await this.db.participant.create({
            data: {
              matchId,
              address: supporter.toLowerCase(),
              role: ParticipantRole.SUPPORTER,
              marginAmount: "0",
              entryFeePaid: "0",
              fundedAmount: delegation.amount,
              pnl: "0",
            },
          });
        }

        // Update delegation spent amount
        const newSpentAmount = (
          BigInt(delegation.spentAmount) + trade.value
        ).toString();
        await this.db.delegation.update({
          where: { id: delegation.id },
          data: { spentAmount: newSpentAmount },
        });

        // Record trade
        await this.tradingService.recordTrade(
          {
            matchId,
            participantId: participant.id,
            delegationId: delegation.id,
            tradeType: TradeType.SUPPORTER_COPY,
            tokenIn: "",
            tokenOut: "",
            amountIn: trade.value.toString(),
            amountOut: "0",
            targetContract: trade.target,
          },
          blockNumber,
          txHash
        );

        this.logger.log(
          `✅ Recorded copy trade for ${supporter}: ${this.contractService.formatEther(trade.value)} ETH`
        );
      } catch (error) {
        this.logger.error(
          `Failed to record trade for ${trade.delegationRecord.supporter}: ${error.message}`
        );
      }
    }
  }

  /**
   * Retrieve signed delegation from database
   * Users sign delegations on frontend, we store them here
   */
  private async getSignedDelegation(
    delegation: DelegationInDb
  ): Promise<SignedDelegation | null> {
    if (!delegation || !delegation.signedDelegation) {
      return null;
    }
    return JSON.parse(delegation.signedDelegation);
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
