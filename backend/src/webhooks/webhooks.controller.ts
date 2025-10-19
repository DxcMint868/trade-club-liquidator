import {
  Controller,
  Post,
  Body,
  Headers,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { createHmac } from "crypto";
import { CopyEngineService } from "../trading/copy-engine.service";
import { MatchesService } from "../matches/matches.service";

/**
 * WebhooksController - Minimal DEX-Agnostic Webhook Router
 *
 * Architecture Philosophy:
 * - Indexer: Encodes DEX-specific function calls (knows about FUNDex, Uniswap, etc.)
 * - Webhook: Validates and routes (no DEX knowledge)
 * - Copy-Engine: Executes batch UserOps (DEX-agnostic)
 *
 * This design allows adding 1000 DEXes without modifying backend code.
 * Just create a new indexer handler with the DEX ABI and encoding logic.
 */

interface TradePayload {
  target: string; // DEX contract address
  value: string; // ETH to send
  data: string; // Pre-encoded function call
}

type EnvioEventType =
  | "match_created"
  | "monachad_joined"
  | "supporter_joined"
  | "match_started"
  | "match_completed"
  | "pnl_updated"
  | "trade_opened"
  | "trade_closed";

interface WebhookPayload {
  eventType: EnvioEventType | string;
  monachadAddress?: string;
  trade?: TradePayload;
  metadata?: {
    dex?: string;
    positionId?: string;
    assetId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly copyEngine: CopyEngineService,
    private readonly eventEmitter: EventEmitter2,
    private readonly matchesService: MatchesService
  ) {
    this.webhookSecret = process.env.ENVIO_WEBHOOK_SECRET || "";
    if (!this.webhookSecret) {
      this.logger.warn(
        "ENVIO_WEBHOOK_SECRET not set - webhook signature validation disabled"
      );
    }
  }

  @Post("envio")
  async handleEnvioWebhook(
    @Body() body: WebhookPayload,
    @Headers("x-Envio-Signature") signature?: string
  ) {
    this.logger.log(`Received webhook: ${body.eventType}`);

    // Validate webhook signature for security
    if (this.webhookSecret && signature) {
      const isValid = this.validateSignature(JSON.stringify(body), signature);
      if (!isValid) {
        this.logger.error("Invalid webhook signature");
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "Invalid signature",
        };
      }
    }

    // Route to appropriate handler based on event type
    try {
      switch (body.eventType) {
        case "trade_opened":
          await this.handleTradeOpened(body);
          break;
        case "trade_closed":
          await this.handleTradeClosed(body);
          break;
        case "match_created": {
          const eventPayload = await this.matchesService.createMatch(body);
          if (eventPayload) {
            this.eventEmitter.emit("match.created", eventPayload);
          }
          break;
        }
        case "monachad_joined": {
          const eventPayload = await this.matchesService.upsertParticipant({
            ...body,
            participant: body.monachad,
            role: "MONACHAD",
          });
          if (eventPayload) {
            this.eventEmitter.emit("match.participant-joined", eventPayload);
          }
          break;
        }
        case "supporter_joined": {
          const eventPayload = await this.matchesService.upsertParticipant({
            ...body,
            participant: body.supporter,
            role: "SUPPORTER",
            followingAddress: body.monachad,
          });
          if (eventPayload) {
            this.eventEmitter.emit("match.participant-joined", eventPayload);
          }
          break;
        }
        case "match_started": {
          const eventPayload =
            await this.matchesService.applyMatchStartedUpdate(body);
          if (eventPayload) {
            this.eventEmitter.emit("match.started", eventPayload);
          }
          break;
        }
        case "match_completed": {
          const eventPayload = await this.matchesService.completeMatch(body);
          if (eventPayload) {
            this.eventEmitter.emit("match.completed", eventPayload);
          }
          break;
        }
        case "pnl_updated": {
          const eventPayload = await this.matchesService.updatePnL(body);
          if (eventPayload) {
            this.eventEmitter.emit("match.pnl-updated", eventPayload);
          }
          break;
        }
        default:
          this.logger.warn(`Unknown event type: ${body.eventType}`);
      }

      return { statusCode: HttpStatus.OK, message: "Webhook processed" };
    } catch (error) {
      this.logger.error("Error processing webhook", error);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Processing failed",
      };
    }
  }

  /**
   * Handle trade opened - DEX agnostic
   * Finds active matches and delegates to copy-engine
   */
  private async handleTradeOpened(payload: WebhookPayload) {
    this.logger.log(
      `Trade opened: Monachad=${payload.monachadAddress}, DEX=${payload.metadata?.dex}`
    );

    if (!payload.monachadAddress) {
      this.logger.warn("trade_opened payload missing monachadAddress");
      return;
    }

    // Find active matches where this address is a Monachad participant
    const matches = await this.matchesService.getActiveMatchesForMonachad(
      payload.monachadAddress
    );

    if (matches.length === 0) {
      this.logger.warn(
        `No active matches found for Monachad ${payload.monachadAddress}`
      );
      return;
    }

    this.logger.log(
      `Found ${matches.length} active match(es) for copy-trading`
    );

    // Execute copy-trading for each match (copy-engine handles all the heavy lifting)
    for (const match of matches) {
      try {
        await this.copyEngine.executeCopyTrades({
          monachadAddress: payload.monachadAddress.toLowerCase(),
          matchId: match.matchId, // Use matchId instead of id
          originalTrade: payload.trade, // Pass through pre-encoded trade data
          metadata: payload.metadata,
        });

        this.logger.log(`Copy-trade executed for match ${match.matchId}`);
      } catch (error) {
        this.logger.error(
          `Failed to execute copy-trade for match ${match.matchId}`,
          error
        );
      }
    }
  }

  /**
   * Handle trade closed - DEX agnostic
   * Finds position mappings and delegates to copy-engine
   *
   * NOTE: Position mapping (Monachad positionId -> Supporter positionIds) needs to be implemented.
   * For now, we execute close trades for all active matches of this Monachad.
   * TODO: Implement proper position tracking (add metadata field to Trade or create PositionMapping table)
   */
  private async handleTradeClosed(payload: WebhookPayload) {
    this.logger.log(
      `Trade closed: Monachad=${payload.monachadAddress}, DEX=${payload.metadata?.dex}`
    );

    if (!payload.monachadAddress) {
      this.logger.warn("trade_closed payload missing monachadAddress");
      return;
    }

    // Find active matches where this address is a Monachad participant
    const matches = await this.matchesService.getActiveMatchesForMonachad(
      payload.monachadAddress
    );

    if (matches.length === 0) {
      this.logger.warn(
        `No active matches found for Monachad ${payload.monachadAddress}`
      );
      return;
    }

    this.logger.log(
      `Found ${matches.length} active match(es), executing close trades`
    );

    // Execute close trades for each match
    for (const match of matches) {
      try {
        await this.copyEngine.executeCopyTrades({
          monachadAddress: payload.monachadAddress.toLowerCase(),
          matchId: match.matchId,
          originalTrade: payload.trade, // Pass through pre-encoded close trade
          metadata: payload.metadata,
        });

        this.logger.log(`Close trade executed for match ${match.matchId}`);
      } catch (error) {
        this.logger.error(
          `Failed to execute close trade for match ${match.matchId}`,
          error
        );
      }
    }
  }

  /**
   * Validate webhook signature using HMAC-SHA256
   */
  private validateSignature(payload: string, signature: string): boolean {
    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    return signature === expectedSignature;
  }
}
