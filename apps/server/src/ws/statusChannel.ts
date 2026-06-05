import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import {
  createStatusMessage,
  type ServerStatus,
  type ServerToClientMessage,
} from '@aspect/shared';

/**
 * Tracks connected clients and lets the rest of the server broadcast status.
 * In this plan the status is synthetic ("online", haConnected=false). Later
 * plans replace the source with the real Home Assistant connection state.
 */
export class StatusHub {
  private readonly clients = new Set<WebSocket>();
  private status: ServerStatus = 'online';
  private haConnected = false;

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    this.send(socket, createStatusMessage(this.status, this.haConnected));
  }

  setStatus(status: ServerStatus, haConnected: boolean): void {
    this.status = status;
    this.haConnected = haConnected;
    const msg = createStatusMessage(status, haConnected);
    for (const socket of this.clients) this.send(socket, msg);
  }

  private send(socket: WebSocket, msg: ServerToClientMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }
}

export async function statusChannel(app: FastifyInstance): Promise<void> {
  const hub = new StatusHub();
  app.decorate('statusHub', hub);
  app.get('/ws', { websocket: true }, (socket) => {
    hub.add(socket);
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    statusHub: StatusHub;
  }
}
