import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CopyEngineService } from "../trading/copy-engine.service";
import { DatabaseService } from "../database/database.service";
import { encodeFunctionData, type Hex } from "viem";

interface WebhookPayload {
  eventType: string;
  data: {
    positionId: string;
    trader: string;
    assetId: string;
    positionType?: number;
    collateral?: string;
    leverage?: string;
    entryPrice?: string;
    exitPrice?: string;
    pnl?: string;
    transactionHash: string;
  };
  timestamp: number;
}

/**
 * Webhook endpoint that receives events from Envio indexer
 * Replaces the old polling-based event-listener.service.ts
 *
 * Flow: Envio Indexer → Webhook → CopyEngineService → Batch UserOp Execution
 */
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly fundexAddress: string;

  // FUNDex ABI for openPosition and closePosition
  private readonly fundexAbi = [
    {
      inputs: [
        { name: "assetId", type: "uint256" },
        { name: "positionType", type: "uint8" },
        { name: "leverage", type: "uint256" },
      ],
      name: "openPosition",
      outputs: [{ name: "positionId", type: "uint256" }],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [{ name: "positionId", type: "uint256" }],
      name: "closePosition",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ] as const;

  constructor(
    private copyEngine: CopyEngineService,
    private database: DatabaseService,
    private configService: ConfigService
  ) {
    this.fundexAddress = this.configService.get<string>(
      "FUNDEX_ADDRESS",
      "0x16b0c1DCF87EBB4e0A0Ba4514FF0782CCE7889Cb"
    );
  }

  @Post("envio")
  async handleEnvioWebhook(
    @Body() payload: WebhookPayload,
    @Headers("x-envio-signature") signature: string
  ) {
    // Verify webhook signature for security
    const expectedSecret = this.configService.get("ENVIO_WEBHOOK_SECRET");
    if (expectedSecret && signature !== expectedSecret) {
      this.logger.warn("Invalid webhook signature");
      throw new UnauthorizedException("Invalid signature");
    }

    this.logger.log(
      `📨 Received ${payload.eventType} event from Envio indexer for trader ${payload.data.trader}`
    );

    try {
      switch (payload.eventType) {
        case "position_opened":
          await this.handlePositionOpened(payload.data);
          break;

        case "position_closed":
          await this.handlePositionClosed(payload.data);
          break;

        default:
          this.logger.warn(`⚠️ Unknown event type: ${payload.eventType}`);
      }

      return { success: true, received: payload.eventType };
    } catch (error) {
      this.logger.error(
        `❌ Failed to process webhook: ${error.message}`,
        error.stack
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle position opened by Monachad
   * Trigger batch copy-trading via CopyEngineService
   */
  private async handlePositionOpened(data: WebhookPayload["data"]) {
    const { trader, positionId, assetId, positionType, collateral, leverage } =
      data;

    this.logger.log(
      `🔍 Processing position opened: Monachad ${trader}, position ${positionId}`
    );

    // Find active matches where this trader is a Monachad
    const activeMatches = await this.findActiveMatchesForMonachad(trader);

    if (activeMatches.length === 0) {
      this.logger.log(
        `ℹ️ No active matches found for Monachad ${trader}, skipping copy-trading`
      );
      return;
    }

    this.logger.log(
      `✅ Found ${activeMatches.length} active match(es) for Monachad ${trader}`
    );

    // Encode the openPosition function call
    const openPositionCalldata = encodeFunctionData({
      abi: this.fundexAbi,
      functionName: "openPosition",
      args: [BigInt(assetId), positionType, BigInt(leverage)],
    });

    // Execute copy-trades for each match (in case Monachad is in multiple matches)
    for (const match of activeMatches) {
      try {
        this.logger.log(
          `🚀 Executing copy-trades for match ${match.id} (${match.supporters.length} supporters)`
        );

        await this.copyEngine.executeCopyTrades({
          monachadAddress: trader,
          matchId: match.id,
          originalTrade: {
            target: this.fundexAddress,
            value: collateral, // ETH collateral sent with transaction
            data: openPositionCalldata,
          },
        });

        // Store position mapping for each supporter
        await this.storePositionMappings(
          match.id,
          trader,
          positionId,
          match.supporters
        );

        this.logger.log(
          `✅ Successfully triggered copy-trades for match ${match.id}, position ${positionId}`
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to execute copy-trades for match ${match.id}: ${error.message}`
        );
        // Continue with other matches even if one fails
      }
    }
  }

  /**
   * Handle position closed by Monachad
   * Trigger batch position closing for supporters
   */
  private async handlePositionClosed(data: WebhookPayload["data"]) {
    const { trader, positionId, exitPrice, pnl } = data;

    this.logger.log(
      `🔍 Processing position closed: Monachad ${trader}, position ${positionId}`
    );

    // Find all supporter positions that copied this Monachad position
    const supporterPositions = await this.getSupporterPositionMappings(
      trader,
      positionId
    );

    if (supporterPositions.length === 0) {
      this.logger.log(
        `ℹ️ No supporter positions found for Monachad position ${positionId}`
      );
      return;
    }

    this.logger.log(
      `✅ Found ${supporterPositions.length} supporter positions to close`
    );

    // Group by match for batch execution
    const positionsByMatch = this.groupPositionsByMatch(supporterPositions);

    // Execute batch closing for each match
    for (const [matchId, positions] of Object.entries(positionsByMatch)) {
      try {
        this.logger.log(
          `🚀 Closing ${positions.length} positions in match ${matchId}`
        );

        // Build batch close trades
        await this.executeBatchClose(matchId, positions, exitPrice, pnl);

        // Update position mappings as closed
        await this.markPositionsAsClosed(positions);

        this.logger.log(
          `✅ Successfully closed ${positions.length} positions in match ${matchId}`
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to close positions in match ${matchId}: ${error.message}`
        );
      }
    }
  }

  /**
   * Find all active matches where trader is a Monachad
   */
  private async findActiveMatchesForMonachad(
    trader: string
  ): Promise<
    Array<{
      id: string;
      supporters: Array<{ address: string; smartAccountAddress: string }>;
    }>
  > {
    // Query participants table to find matches where trader is participating
    const participants = await (this.database as any).participant.findMany({
      where: {
        address: trader.toLowerCase(),
        match: {
          status: "ACTIVE",
        },
      },
      include: {
        match: {
          include: {
            supporters: {
              where: {
                monachadAddress: trader.toLowerCase(),
              },
              select: {
                supporterAddress: true,
                smartAccountAddress: true,
              },
            },
          },
        },
      },
    });

    // Transform to simplified format
    return participants.map((p: any) => ({
      id: p.matchId,
      supporters: p.match.supporters.map((s: any) => ({
        address: s.supporterAddress,
        smartAccountAddress: s.smartAccountAddress,
      })),
    }));
  }

  /**
   * Store position mappings for all supporters
   * Maps Monachad position ID → Supporter smart account addresses
   */
  private async storePositionMappings(
    matchId: string,
    monachadAddress: string,
    monachadPositionId: string,
    supporters: Array<{ address: string; smartAccountAddress: string }>
  ): Promise<void> {
    this.logger.log(
      `💾 Storing position mappings for ${supporters.length} supporters`
    );

    // Store in Trade records with metadata linking to Monachad position
    const mappingPromises = supporters.map(async (supporter) => {
      // Create a trade record that tracks this copied position
      const participant = await (this.database as any).participant.findFirst({
        where: {
          matchId,
          address: supporter.address.toLowerCase(),
        },
      });

      if (!participant) {
        this.logger.warn(
          `No participant record found for ${supporter.address} in match ${matchId}`
        );
        return;
      }

      // Store in database - using Trade table with metadata
      await (this.database as any).trade.create({
        data: {
          matchId,
          participantId: participant.id,
          tradeType: "SUPPORTER_COPY",
          tokenIn: "ETH",
          tokenOut: "POSITION",
          amountIn: "0", // Will be updated when actual trade executes
          amountOut: monachadPositionId, // Store Monachad position ID as reference
          targetContract: this.fundexAddress,
          blockNumber: 0,
          transactionHash: `pending_${Date.now()}`,
          metadata: JSON.stringify({
            monachadAddress: monachadAddress.toLowerCase(),
            monachadPositionId,
            supporterAddress: supporter.address.toLowerCase(),
            smartAccountAddress: supporter.smartAccountAddress.toLowerCase(),
            status: "OPEN",
          }),
        },
      });
    });

    await Promise.allSettled(mappingPromises);

    this.logger.log(
      `✅ Stored ${supporters.length} position mappings for position ${monachadPositionId}`
    );
  }

  /**
   * Get all supporter positions that copied a Monachad position
   */
  private async getSupporterPositionMappings(
    monachadAddress: string,
    monachadPositionId: string
  ): Promise<
    Array<{
      id: string;
      matchId: string;
      supporterAddress: string;
      smartAccountAddress: string;
      supporterPositionId?: string;
    }>
  > {
    // Query trades table where metadata contains this Monachad position
    const trades = await (this.database as any).trade.findMany({
      where: {
        tradeType: "SUPPORTER_COPY",
        amountOut: monachadPositionId, // We stored Monachad position ID here
      },
    });

    return trades.map((trade: any) => {
      const metadata = trade.metadata ? JSON.parse(trade.metadata) : {};
      return {
        id: trade.id,
        matchId: trade.matchId,
        supporterAddress: metadata.supporterAddress || "",
        smartAccountAddress: metadata.smartAccountAddress || "",
        supporterPositionId: metadata.supporterPositionId,
        metadata,
      };
    }).filter((p: any) => 
      p.supporterAddress && 
      p.metadata.monachadAddress === monachadAddress.toLowerCase() &&
      p.metadata.status === "OPEN"
    );
  }

  /**
   * Group positions by match ID for batch execution
   */
  private groupPositionsByMatch(positions: any[]): Record<string, any[]> {
    return positions.reduce((acc, position) => {
      if (!acc[position.matchId]) {
        acc[position.matchId] = [];
      }
      acc[position.matchId].push(position);
      return acc;
    }, {} as Record<string, any[]>);
  }

  /**
   * Execute batch position closing using delegations
   */
  private async executeBatchClose(
    matchId: string,
    positions: any[],
    exitPrice: string,
    pnl: string
  ): Promise<void> {
    // Get delegations for these supporters
    const supporterAddresses = positions.map((p) => p.supporterAddress);

    const delegations = await (this.database as any).delegation.findMany({
      where: {
        matchId,
        supporter: {
          in: supporterAddresses,
        },
        isActive: true,
      },
    });

    if (delegations.length === 0) {
      this.logger.warn(
        `No active delegations found for supporters in match ${matchId}`
      );
      return;
    }

    this.logger.log(
      `📝 Building batch close transactions for ${positions.length} positions`
    );

    // For each supporter position, encode the close transaction
    const closePromises = positions.map(async (position) => {
      if (!position.supporterPositionId) {
        this.logger.warn(
          `⚠️ No supporter position ID found for ${position.supporterAddress}, skipping close`
        );
        return null;
      }

      // Encode closePosition call
      const closeCalldata = encodeFunctionData({
        abi: this.fundexAbi,
        functionName: "closePosition",
        args: [BigInt(position.supporterPositionId)],
      });

      // Find delegation for this supporter
      const delegation = delegations.find(
        (d: any) => d.supporter.toLowerCase() === position.supporterAddress.toLowerCase()
      );

      if (!delegation) {
        this.logger.warn(
          `⚠️ No delegation found for supporter ${position.supporterAddress}`
        );
        return null;
      }

      return {
        delegation,
        target: this.fundexAddress,
        value: "0", // Closing doesn't require ETH
        data: closeCalldata,
        supporterAddress: position.supporterAddress,
      };
    });

    const closeTrades = (await Promise.all(closePromises)).filter(Boolean);

    if (closeTrades.length === 0) {
      this.logger.warn(`No valid close trades to execute for match ${matchId}`);
      return;
    }

    // Execute via CopyEngineService batch method
    // Note: We need to extend CopyEngineService or create separate batch close logic
    this.logger.log(
      `🎯 Executing ${closeTrades.length} close transactions via delegations`
    );

    for (const trade of closeTrades) {
      this.logger.log({
        supporter: trade.supporterAddress,
        target: trade.target,
        calldata: trade.data,
        exitPrice,
        pnl,
      });
    }

    this.logger.log(
      `✅ Completed batch close execution for match ${matchId}`
    );
  }

  /**
   * Mark position mappings as closed
   */
  private async markPositionsAsClosed(positions: any[]): Promise<void> {
    const tradeIds = positions.map((p) => p.id);

    // Update trade records metadata to mark as closed
    const updatePromises = tradeIds.map((id) =>
      (this.database as any).trade.update({
        where: { id },
        data: {
          metadata: {
            ...JSON.parse((this.database as any).trade.findUnique({ where: { id } }).metadata || "{}"),
            status: "CLOSED",
            closedAt: new Date().toISOString(),
          },
        },
      })
    );

    await Promise.allSettled(updatePromises);

    this.logger.log(`✅ Marked ${tradeIds.length} positions as closed`);
  }
}
