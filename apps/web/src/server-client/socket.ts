import type { ClientToServerMessage } from '@aspect/shared';
import { handleRawMessage } from './messageHandler.js';
import { useConnectionStore } from '../store/connectionStore.js';

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;

let activeSocket: WebSocket | null = null;

/**
 * Maintains a resilient WebSocket to the Aspect server. Reconnects with
 * exponential backoff and routes every payload through handleRawMessage.
 * Returns a disposer that closes the socket and stops reconnecting.
 */
export function connectToServer(url?: string): () => void {
  const target = url ?? defaultUrl();
  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const open = (): void => {
    useConnectionStore.getState().setLink('connecting');
    socket = new WebSocket(target);
    activeSocket = socket;

    socket.onopen = () => {
      backoff = INITIAL_BACKOFF_MS;
      useConnectionStore.getState().setLink('connected');
    };
    socket.onmessage = (event) => handleRawMessage(String(event.data));
    socket.onclose = () => {
      if (activeSocket === socket) activeSocket = null;
      useConnectionStore.getState().setLink('disconnected');
      if (!disposed) scheduleReconnect();
    };
    socket.onerror = (event) => (event.target as WebSocket).close();
  };

  const scheduleReconnect = (): void => {
    timer = setTimeout(open, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  };

  open();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}

function defaultUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

/** Sends a message to the Aspect server if the socket is open. Returns success. */
export function sendToServer(msg: ClientToServerMessage): boolean {
  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    activeSocket.send(JSON.stringify(msg));
    return true;
  }
  return false;
}
