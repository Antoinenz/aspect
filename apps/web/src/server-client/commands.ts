import { createCallServiceMessage } from '@aspect/shared';
import { sendToServer } from './socket.js';

/** Sends a Home Assistant service call to the server. */
export function callService(
  domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>,
): void {
  sendToServer(createCallServiceMessage(domain, service, entityId, data));
}
