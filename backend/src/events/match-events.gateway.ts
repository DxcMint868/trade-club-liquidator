import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

export interface CopyTradeEvent {
  matchId: string;
  monachadAddress: string;
  supporterAddress: string;
  tradeType: "OPEN" | "CLOSE";
  dex: string;
  amount: string;
  positionType?: "LONG" | "SHORT";
  leverage?: string;
  assetId?: string;
  transactionHash: string;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: "*", // In production, specify your frontend URL
  },
})
export class MatchEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchEventsGateway.name);
  private readonly matchSubscriptions = new Map<string, Set<string>>(); // matchId -> Set of socketIds

  constructor() {
    this.logger.log("MatchEventsGateway initialized");
  }

  @OnEvent("monachad.trade")
  handleMonachadTrade(event: any) {
    this.logger.log("Gateway received monachad.trade event");
    this.emitMonachadTrade(event);
  }

  @OnEvent("monachad.batchTrades")
  handleMonachadBatchTrades(events: any[]) {
    this.logger.log("Gateway received monachad.batchTrades event");
    this.emitBatchMonachadTrades(events);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up subscriptions
    for (const [matchId, clients] of this.matchSubscriptions.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.matchSubscriptions.delete(matchId);
        }
      }
    }
  }

  @SubscribeMessage("subscribeToMatch")
  handleSubscribeToMatch(client: Socket, matchId: string) {
    this.logger.log(`Client ${client.id} subscribing to match ${matchId}`);

    if (!this.matchSubscriptions.has(matchId)) {
      this.matchSubscriptions.set(matchId, new Set());
    }

    this.matchSubscriptions.get(matchId)!.add(client.id);
    client.join(`match:${matchId}`);
    const subscribers = this.matchSubscriptions.get(matchId)!.size;
    this.logger.log(`Match ${matchId} subscribers=${subscribers}`);

    return { success: true, matchId, subscribers };
  }

  @SubscribeMessage("unsubscribeFromMatch")
  handleUnsubscribeFromMatch(client: Socket, matchId: string) {
    this.logger.log(`Client ${client.id} unsubscribing from match ${matchId}`);

    const clients = this.matchSubscriptions.get(matchId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.matchSubscriptions.delete(matchId);
      }
    }

    client.leave(`match:${matchId}`);
    const clientsLeft = this.matchSubscriptions.get(matchId)?.size ?? 0;
    this.logger.log(`Match ${matchId} subscribers=${clientsLeft}`);

    return { success: true, matchId, subscribers: clientsLeft };
  }

  /**
   * Emit copy trade execution to all clients watching this match
   */
  emitCopyTrade(event: CopyTradeEvent) {
    const room = `match:${event.matchId}`;

    this.logger.log(
      `Emitting copy trade for supporter ${event.supporterAddress} in match ${event.matchId}`
    );

    this.server.to(room).emit("copyTradeExecuted", event);
  }

  /**
   * Emit batch of copy trades (when multiple supporters copy the same trade)
   */
  emitBatchCopyTrades(events: CopyTradeEvent[]) {
    if (events.length === 0) return;

    const matchId = events[0].matchId;
    const room = `match:${matchId}`;

    this.logger.log(
      `Emitting batch of ${events.length} copy trades for match ${matchId}`
    );

    this.server.to(room).emit("batchCopyTradesExecuted", {
      matchId,
      trades: events,
      count: events.length,
    });
  }

  /**
   * Emit Monachad original trade to all clients watching this match
   */
  emitMonachadTrade(event: any) {
    const room = `match:${event.matchId}`;
    this.logger.log(
      `Emitting Monachad trade for ${event.monachadAddress} in match ${event.matchId}`
    );
    const subs = this.matchSubscriptions.get(event.matchId);
    this.logger.log(`Target room=${room} subscribers=${subs ? subs.size : 0}`);
    if (subs && subs.size > 0) {
      this.logger.log(`Subscriber ids: ${Array.from(subs).join(",")}`);
    }
    this.logger.log(
      `Emitting monachadTradeExecuted to room=${room} payload=${JSON.stringify(event)}`
    );
    this.server.to(room).emit("monachadTradeExecuted", event);
  }

  /**
   * Emit batch of Monachad original trades
   */
  emitBatchMonachadTrades(events: any[]) {
    if (events.length === 0) return;
    const matchId = events[0].matchId;
    const room = `match:${matchId}`;
    this.logger.log(
      `Emitting batch of ${events.length} Monachad trades for match ${matchId}`
    );
    const subs = this.matchSubscriptions.get(matchId);
    this.logger.log(`Target room=${room} subscribers=${subs ? subs.size : 0}`);
    if (subs && subs.size > 0) {
      this.logger.log(`Subscriber ids: ${Array.from(subs).join(",")}`);
    }
    this.logger.log(
      `Emitting batchMonachadTradesExecuted to room=${room} count=${events.length}`
    );
    this.server.to(room).emit("batchMonachadTradesExecuted", {
      matchId,
      trades: events,
      count: events.length,
    });
  }

  /**
   * Emit match status update
   */
  emitMatchUpdate(matchId: string, data: any) {
    const room = `match:${matchId}`;
    this.server.to(room).emit("matchUpdated", { matchId, ...data });
  }
}
