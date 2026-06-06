import {
  createConnection,
  createLongLivedTokenAuth,
  getStates,
  type Connection,
} from 'home-assistant-js-websocket';
import type { ClientHub } from '../ws/clientChannel.js';
import type { HaCache } from '../cache/haCache.js';
import {
  normalizeArea,
  normalizeDevice,
  normalizeEntity,
  normalizeRegistryEntry,
  type RawArea,
  type RawDevice,
  type RawHassEntity,
  type RawRegistryEntry,
} from './normalize.js';

export interface HaConnectionOptions {
  url: string;
  token: string;
  cache: HaCache;
  hub: ClientHub;
}

export interface HaConnectionHandle {
  connection: Connection;
  stop: () => void;
}

interface StateChangedData {
  entity_id: string;
  new_state: RawHassEntity | null;
}

/**
 * Connects to Home Assistant and keeps the cache + hub in sync. The hub is the
 * only fan-out point; this layer never talks to web clients directly.
 */
export async function startHaConnection(
  opts: HaConnectionOptions,
): Promise<HaConnectionHandle> {
  const { url, token, cache, hub } = opts;
  const auth = createLongLivedTokenAuth(url, token);
  const connection = await createConnection({ auth });

  // Establish subscriptions BEFORE the initial load so live updates always flow
  // even if a load fails. home-assistant-js-websocket automatically re-creates
  // these subscriptions across reconnects, so they are set up exactly once here.
  await connection.subscribeEvents((event: { data: StateChangedData }) => {
    handleStateChanged(event.data, cache, hub);
  }, 'state_changed');

  for (const evt of [
    'area_registry_updated',
    'device_registry_updated',
    'entity_registry_updated',
  ]) {
    await connection.subscribeEvents(() => {
      void refreshRegistries(connection, cache, hub);
    }, evt);
  }

  // Reload the full world on every (re)connection. The library fires `ready`
  // on reconnect (not on the initial connect, which already happened above).
  connection.addEventListener('ready', () => {
    void loadEverything(connection, cache, hub);
  });
  connection.addEventListener('disconnected', () => {
    hub.setStatus('degraded', false);
  });

  // A failed initial load leaves us connected but degraded; the next `ready`
  // retries it. We still return a handle so the caller can shut the socket down.
  // (Note: deltas arriving during a reload's in-flight fetch can be briefly
  // overwritten by the snapshot; they self-heal on the next state change.)
  try {
    await loadEverything(connection, cache, hub);
  } catch {
    hub.setStatus('degraded', false);
  }

  return {
    connection,
    stop: () => connection.close(),
  };
}

async function loadEverything(
  connection: Connection,
  cache: HaCache,
  hub: ClientHub,
): Promise<void> {
  const [rawStates, areas, devices, registry] = await Promise.all([
    getStates(connection) as Promise<RawHassEntity[]>,
    listAreas(connection),
    listDevices(connection),
    listEntityRegistry(connection),
  ]);
  cache.setSnapshot({
    entities: rawStates.map(normalizeEntity),
    areas: areas.map(normalizeArea),
    devices: devices.map(normalizeDevice),
    registry: registry.map(normalizeRegistryEntry),
  });
  hub.setStatus('online', true);
  hub.broadcastSnapshot();
}

async function refreshRegistries(
  connection: Connection,
  cache: HaCache,
  hub: ClientHub,
): Promise<void> {
  const [areas, devices, registry] = await Promise.all([
    listAreas(connection),
    listDevices(connection),
    listEntityRegistry(connection),
  ]);
  cache.setRegistries({
    areas: areas.map(normalizeArea),
    devices: devices.map(normalizeDevice),
    registry: registry.map(normalizeRegistryEntry),
  });
  hub.broadcastSnapshot();
}

function handleStateChanged(
  data: StateChangedData,
  cache: HaCache,
  hub: ClientHub,
): void {
  if (data.new_state === null) {
    if (cache.removeEntity(data.entity_id)) {
      hub.broadcastEntityUpdate([], [data.entity_id]);
    }
    return;
  }
  const entity = normalizeEntity(data.new_state);
  if (cache.applyEntity(entity)) {
    hub.broadcastEntityUpdate([entity]);
  }
}

function listAreas(connection: Connection): Promise<RawArea[]> {
  return connection.sendMessagePromise({ type: 'config/area_registry/list' });
}

function listDevices(connection: Connection): Promise<RawDevice[]> {
  return connection.sendMessagePromise({ type: 'config/device_registry/list' });
}

function listEntityRegistry(
  connection: Connection,
): Promise<RawRegistryEntry[]> {
  return connection.sendMessagePromise({
    type: 'config/entity_registry/list',
  });
}
