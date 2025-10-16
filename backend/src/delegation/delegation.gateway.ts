import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class DelegationGateway {
  @WebSocketServer()
  server: Server;

  @OnEvent("delegation.created")
  handleDelegationCreated(payload: any) {
    this.server.emit("delegation:created", payload);
  }

  @OnEvent("delegation.revoked")
  handleDelegationRevoked(payload: any) {
    this.server.emit("delegation:revoked", payload);
  }

  @OnEvent("delegation.executed")
  handleDelegationExecuted(payload: any) {
    this.server.emit("delegation:executed", payload);
  }

  sendDelegationUpdate(delegationHash: string, data: any) {
    this.server.emit("delegation:update", {
      delegationHash,
      ...data,
      timestamp: Date.now(),
    });
  }
}
