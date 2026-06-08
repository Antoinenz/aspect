import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { WebSocket } from '@fastify/websocket';
import {
  createStatusMessage,
  createSnapshotMessage,
  createEntityUpdateMessage,
  createFavoritesMessage,
  isClientToServerMessage,
  type EntityState,
  type ServerStatus,
  type ServerToClientMessage,
} from '@aspect/shared';
import type { HaCache } from '../cache/haCache.js';
import type { FavoritesStore } from '../db/favoritesStore.js';

export type ServiceCaller = (
  domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>,
) => void | Promise<void>;

/**
 * Tracks connected web clients. Greets each new client with the current status
 * and a world snapshot from the cache, and broadcasts status changes, entity
 * updates, and re-snapshots. This is the single fan-out point to the family's
 * devices; the Home Assistant connection layer drives it.
 */
export class ClientHub {
  private readonly clients = new Set<WebSocket>();
  private status: ServerStatus = 'connecting';
  private haConnected = false;
  private serviceCaller: ServiceCaller | null = null;

  constructor(
    private readonly cache: HaCache,
    private readonly favorites: FavoritesStore,
  ) {}

  setServiceCaller(caller: ServiceCaller): void {
    this.serviceCaller = caller;
  }

  handleClientMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isClientToServerMessage(parsed)) return;
    if (parsed.type === 'call_service' && this.serviceCaller) {
      void this.serviceCaller(parsed.domain, parsed.service, parsed.entityId, parsed.data);
    }
    if (parsed.type === 'set_favorite') {
      this.favorites.set(parsed.entityId, parsed.favorite);
      this.broadcastFavorites();
    }
    if (parsed.type === 'reorder_favorites') {
      this.favorites.reorder(parsed.entityIds);
      this.broadcastFavorites();
    }
  }

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    this.send(socket, createStatusMessage(this.status, this.haConnected));
    this.send(socket, createSnapshotMessage(this.cache.getSnapshot()));
    this.send(socket, createFavoritesMessage(this.favorites.list()));
  }

  setStatus(status: ServerStatus, haConnected: boolean): void {
    this.status = status;
    this.haConnected = haConnected;
    this.broadcast(createStatusMessage(status, haConnected));
  }

  broadcastFavorites(): void {
    this.broadcast(createFavoritesMessage(this.favorites.list()));
  }

  /** Re-send the full world (used after a registry change). */
  broadcastSnapshot(): void {
    this.broadcast(createSnapshotMessage(this.cache.getSnapshot()));
  }

  broadcastEntityUpdate(entities: EntityState[], removed: string[] = []): void {
    if (entities.length === 0 && removed.length === 0) return;
    this.broadcast(createEntityUpdateMessage(entities, removed));
  }

  private broadcast(msg: ServerToClientMessage): void {
    for (const socket of this.clients) this.send(socket, msg);
  }

  private send(socket: WebSocket, msg: ServerToClientMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }
}

export interface ClientChannelOptions {
  cache: HaCache;
  favorites: FavoritesStore;
}

/**
 * Wrapped with fastify-plugin so the `clientHub` and `haCache` decorations
 * propagate to the parent (root) instance for the connection layer to use.
 */
export const clientChannel = fp(
  async function clientChannel(
    app: FastifyInstance,
    opts: ClientChannelOptions,
  ): Promise<void> {
    const hub = new ClientHub(opts.cache, opts.favorites);
    app.decorate('clientHub', hub);
    app.decorate('haCache', opts.cache);
    app.get('/ws', { websocket: true }, (socket) => {
      hub.add(socket);
      socket.on('message', (raw) => hub.handleClientMessage(raw.toString()));
    });
  },
  { name: 'client-channel' },
);

declare module 'fastify' {
  interface FastifyInstance {
    clientHub: ClientHub;
    haCache: HaCache;
  }
}
