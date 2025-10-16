import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class MatchesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  // Broadcast match events to all connected clients
  @OnEvent("match.created")
  handleMatchCreated(payload: any) {
    this.server.emit("match:created", payload);
  }

  @OnEvent("match.participant-joined")
  handleParticipantJoined(payload: any) {
    this.server.emit("match:participant-joined", payload);
  }

  @OnEvent("match.started")
  handleMatchStarted(payload: any) {
    this.server.emit("match:started", payload);
  }

  @OnEvent("match.completed")
  handleMatchCompleted(payload: any) {
    this.server.emit("match:completed", payload);
  }

  @OnEvent("match.pnl-updated")
  handlePnLUpdated(payload: any) {
    this.server.emit("match:pnl-updated", payload);
  }

  // Send real-time leaderboard updates
  sendLeaderboardUpdate(matchId: string, leaderboard: any[]) {
    this.server.emit("match:leaderboard-update", {
      matchId,
      leaderboard,
      timestamp: Date.now(),
    });
  }

  // Send trade execution notification
  sendTradeNotification(matchId: string, participant: string, trade: any) {
    this.server.emit("match:trade-executed", {
      matchId,
      participant,
      trade,
      timestamp: Date.now(),
    });
  }
}
