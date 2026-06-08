import { createCallServiceMessage, createSetFavoriteMessage, createReorderFavoritesMessage } from '@aspect/shared';
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

/** Pins or unpins an entity as a favorite. */
export function setFavorite(entityId: string, favorite: boolean): void {
  sendToServer(createSetFavoriteMessage(entityId, favorite));
}

/** Sets the display order of all favorites. */
export function reorderFavorites(entityIds: string[]): void {
  sendToServer(createReorderFavoritesMessage(entityIds));
}
