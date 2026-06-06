import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
} from './entities.js';

/** High-level health of the Aspect server. */
export type ServerStatus = 'connecting' | 'online' | 'degraded';

/** Every valid {@link ServerStatus} value, for runtime validation. */
const SERVER_STATUSES: ReadonlySet<string> = new Set<ServerStatus>([
  'connecting',
  'online',
  'degraded',
]);

/** Pushed by the server to every client whenever its status changes. */
export interface StatusMessage {
  type: 'status';
  status: ServerStatus;
  /** Whether the server currently holds a live Home Assistant connection. */
  haConnected: boolean;
  /** Unix epoch milliseconds when the message was created. */
  ts: number;
}

/** Sent once when a client connects (and again after a full registry change). */
export interface SnapshotMessage {
  type: 'snapshot';
  entities: EntityState[];
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
}

/** Sent when one or more entities change or are removed. */
export interface EntityUpdateMessage {
  type: 'entity_update';
  /** Added or changed entities. */
  entities: EntityState[];
  /** Entity IDs that no longer exist. */
  removed: string[];
}

/** Union of every message the server can send to a client. */
export type ServerToClientMessage =
  | StatusMessage
  | SnapshotMessage
  | EntityUpdateMessage;

/** Sent by a client immediately after connecting. */
export interface HelloMessage {
  type: 'hello';
  clientId: string;
}

/** Asks the server to call a Home Assistant service on one entity. */
export interface CallServiceMessage {
  type: 'call_service';
  domain: string;
  service: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/** Union of every message a client can send to the server. */
export type ClientToServerMessage = HelloMessage | CallServiceMessage;

export function createCallServiceMessage(
  domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>,
): CallServiceMessage {
  return { type: 'call_service', domain, service, entityId, ...(data ? { data } : {}) };
}

export function isClientToServerMessage(
  value: unknown,
): value is ClientToServerMessage {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  switch (c.type) {
    case 'hello':
      return typeof c.clientId === 'string';
    case 'call_service':
      return (
        typeof c.domain === 'string' &&
        typeof c.service === 'string' &&
        typeof c.entityId === 'string' &&
        (c.data === undefined ||
          (typeof c.data === 'object' && c.data !== null))
      );
    default:
      return false;
  }
}

export function createStatusMessage(
  status: ServerStatus,
  haConnected: boolean,
): StatusMessage {
  return { type: 'status', status, haConnected, ts: Date.now() };
}

export function createSnapshotMessage(snapshot: {
  entities: EntityState[];
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
}): SnapshotMessage {
  return { type: 'snapshot', ...snapshot };
}

export function createEntityUpdateMessage(
  entities: EntityState[],
  removed: string[] = [],
): EntityUpdateMessage {
  return { type: 'entity_update', entities, removed };
}

export function isServerToClientMessage(
  value: unknown,
): value is ServerToClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  switch (c.type) {
    case 'status':
      return (
        typeof c.status === 'string' &&
        SERVER_STATUSES.has(c.status) &&
        typeof c.haConnected === 'boolean' &&
        typeof c.ts === 'number'
      );
    case 'snapshot':
      return (
        Array.isArray(c.entities) &&
        Array.isArray(c.areas) &&
        Array.isArray(c.devices) &&
        Array.isArray(c.registry)
      );
    case 'entity_update':
      return Array.isArray(c.entities) && Array.isArray(c.removed);
    default:
      return false;
  }
}
