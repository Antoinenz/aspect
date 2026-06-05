/** High-level health of the Aspect server. */
export type ServerStatus = 'connecting' | 'online' | 'degraded';

/** Pushed by the server to every client whenever its status changes. */
export interface StatusMessage {
  type: 'status';
  status: ServerStatus;
  /** Whether the server currently holds a live Home Assistant connection. */
  haConnected: boolean;
  /** Unix epoch milliseconds when the message was created. */
  ts: number;
}

/** Union of every message the server can send to a client. */
export type ServerToClientMessage = StatusMessage;

/** Sent by a client immediately after connecting. */
export interface HelloMessage {
  type: 'hello';
  clientId: string;
}

/** Union of every message a client can send to the server. */
export type ClientToServerMessage = HelloMessage;

export function createStatusMessage(
  status: ServerStatus,
  haConnected: boolean,
): StatusMessage {
  return { type: 'status', status, haConnected, ts: Date.now() };
}

export function isServerToClientMessage(
  value: unknown,
): value is ServerToClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'status' &&
    typeof candidate.status === 'string' &&
    typeof candidate.haConnected === 'boolean' &&
    typeof candidate.ts === 'number'
  );
}
