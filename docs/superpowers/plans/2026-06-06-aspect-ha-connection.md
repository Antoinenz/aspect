# Aspect — Home Assistant Connection, Cache & State Fan-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Aspect server the real (and only) Home Assistant client: connect to HA over its WebSocket API, load the initial entity states plus the area/device/entity registries, keep entity state live via `state_changed` events, cache it all in memory, and fan a snapshot + incremental updates out to every connected web client over the existing `/ws` channel. Drive the connection status from real HA events. Ship a wire-accurate mock HA WebSocket server so the whole stack is testable with no live Home Assistant.

**Architecture:** The server gains three new units behind clean seams. `ha/` holds the connection (built on `home-assistant-js-websocket`) and pure normalizers that map HA's raw wire shapes into Aspect's own domain types. `cache/` holds an in-memory `HaCache` (the authoritative state). The existing WebSocket hub is generalized from `StatusHub` into `ClientHub`, which now also greets each client with a snapshot from the cache and broadcasts entity updates. `home-assistant-js-websocket` runs in Node using Node 22's built-in global `WebSocket`. Clients still talk only to the Aspect server; this plan adds the data, not a new transport.

**Tech Stack:** (unchanged from Plan 1) Node 22, pnpm 9, TypeScript 5.7 ESM strict, Fastify 5 + `@fastify/websocket`, Vitest 3, React 19 + Vite 6 + Motion. **New dependency:** `home-assistant-js-websocket@9.4.0` (server). The `ws` package (already a server devDep) powers the mock HA server in tests.

**Prerequisite:** Plan 1 is merged to `main`. Run all commands from the repo root. On the local Windows dev machine, `pnpm` lives at `C:\Users\antoi\AppData\Roaming\npm`; if `pnpm` is not found, prefix PowerShell commands with `$env:Path = "C:\Users\antoi\AppData\Roaming\npm;$env:Path";`.

---

## File Structure

```
packages/shared/src/
  entities.ts                 NEW  domain types: EntityState, Area, Device, RegistryEntry
  entities.test.ts            NEW  (type-only file has no runtime test; see Task 1)
  messages.ts                 MOD  add Snapshot/EntityUpdate messages + factories + guards
  messages.test.ts            MOD  add tests for new messages
  index.ts                    MOD  re-export entities

apps/server/src/
  config.ts                   MOD  add haUrl, haToken
  ha/
    normalize.ts              NEW  pure HA-wire -> domain mappers
    connection.ts            NEW  startHaConnection(): wires HA -> cache + hub
  cache/
    haCache.ts                NEW  in-memory authoritative cache
  ws/
    clientChannel.ts          NEW  (renamed from ws/statusChannel.ts) ClientHub + /ws
  app.ts                      MOD  create cache, register clientChannel with cache
  server.ts                   MOD  start HA connection after listen (if configured)

apps/server/test/
  helpers/mockHaServer.ts     NEW  wire-accurate mock HA WebSocket server
  helpers/wsTestClient.ts     (unchanged)
  ha/normalize.test.ts        NEW
  cache/haCache.test.ts       NEW
  helpers/mockHaServer.test.ts NEW  proves the mock speaks the protocol
  ha/connection.test.ts       NEW  integration: mock HA -> cache + status
  clientChannel.test.ts       NEW  (renamed from statusChannel.test.ts) + snapshot/fan-out
  fanout.test.ts              NEW  full stack: mock HA -> server -> ws client

apps/web/src/
  store/connectionStore.ts    MOD  hold entities/areas/devices/registry + appliers
  store/connectionStore.test.ts MOD
  server-client/messageHandler.ts MOD  dispatch snapshot/entity_update
  server-client/messageHandler.test.ts MOD
  App.tsx                     MOD  show live entity/area counts
  App.test.tsx                MOD
```

**Boundary rationale:** `normalize.ts` is pure (no I/O) so the fragile "HA shape → our shape" mapping is unit-tested exhaustively without a socket. `haCache.ts` is a passive store with no HA or socket knowledge. `connection.ts` is the only place that knows the `home-assistant-js-websocket` API; it orchestrates cache + hub. The mock HA server lets every layer above be integration-tested deterministically.

---

## Task 1: Shared domain types and message contracts

**Files:**
- Create: `packages/shared/src/entities.ts`
- Modify: `packages/shared/src/index.ts`
- Modify (replace): `packages/shared/src/messages.ts`
- Modify: `packages/shared/src/messages.test.ts`

- [ ] **Step 1: Create `packages/shared/src/entities.ts`**

```ts
/** A single Home Assistant entity's current state, normalized for Aspect. */
export interface EntityState {
  entityId: string;
  /** e.g. "on", "off", "23.5", "unavailable". */
  state: string;
  attributes: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  lastChanged: string;
  /** ISO 8601 timestamp. */
  lastUpdated: string;
}

/** A Home Assistant area (room/zone). */
export interface Area {
  areaId: string;
  name: string;
}

/** A Home Assistant device. */
export interface Device {
  deviceId: string;
  name: string | null;
  areaId: string | null;
}

/** A Home Assistant entity-registry entry (links an entity to a device/area). */
export interface RegistryEntry {
  entityId: string;
  deviceId: string | null;
  areaId: string | null;
  /** User-given or original friendly name, if any. */
  name: string | null;
  platform: string;
}

/** The full cached world the server knows about. */
export interface WorldSnapshot {
  entities: EntityState[];
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
}
```

- [ ] **Step 2: Replace `packages/shared/src/messages.ts` with the extended contract**

```ts
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

/** Union of every message a client can send to the server. */
export type ClientToServerMessage = HelloMessage;

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
```

- [ ] **Step 3: Update `packages/shared/src/index.ts`**

```ts
export * from './entities.js';
export * from './messages.js';
```

- [ ] **Step 4: Add tests to `packages/shared/src/messages.test.ts`**

Replace the entire file with:

```ts
import { describe, it, expect } from 'vitest';
import {
  createStatusMessage,
  createSnapshotMessage,
  createEntityUpdateMessage,
  isServerToClientMessage,
  type StatusMessage,
} from './messages.js';
import type { EntityState } from './entities.js';

const sampleEntity: EntityState = {
  entityId: 'light.kitchen',
  state: 'on',
  attributes: { brightness: 200 },
  lastChanged: '2026-01-01T00:00:00Z',
  lastUpdated: '2026-01-01T00:00:00Z',
};

describe('createStatusMessage', () => {
  it('builds a status message with a timestamp', () => {
    const before = Date.now();
    const msg = createStatusMessage('online', true);
    expect(msg.type).toBe('status');
    expect(msg.status).toBe('online');
    expect(msg.haConnected).toBe(true);
    expect(msg.ts).toBeGreaterThanOrEqual(before);
  });
});

describe('createSnapshotMessage', () => {
  it('wraps the world payload', () => {
    const msg = createSnapshotMessage({
      entities: [sampleEntity],
      areas: [{ areaId: 'kitchen', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    expect(msg.type).toBe('snapshot');
    expect(msg.entities).toHaveLength(1);
    expect(msg.areas[0]?.name).toBe('Kitchen');
  });
});

describe('createEntityUpdateMessage', () => {
  it('defaults removed to an empty array', () => {
    const msg = createEntityUpdateMessage([sampleEntity]);
    expect(msg.type).toBe('entity_update');
    expect(msg.removed).toEqual([]);
  });
});

describe('isServerToClientMessage', () => {
  it('accepts a valid status message', () => {
    const msg: StatusMessage = createStatusMessage('degraded', false);
    expect(isServerToClientMessage(msg)).toBe(true);
  });

  it('accepts snapshot and entity_update messages', () => {
    expect(
      isServerToClientMessage(
        createSnapshotMessage({
          entities: [],
          areas: [],
          devices: [],
          registry: [],
        }),
      ),
    ).toBe(true);
    expect(isServerToClientMessage(createEntityUpdateMessage([]))).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isServerToClientMessage({ type: 'nope' })).toBe(false);
    expect(isServerToClientMessage(null)).toBe(false);
    expect(isServerToClientMessage('status')).toBe(false);
  });

  it('rejects a status message with an unknown status value', () => {
    expect(
      isServerToClientMessage({
        type: 'status',
        status: 'bogus',
        haConnected: false,
        ts: Date.now(),
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 5: Run the shared tests and typecheck**

Run: `pnpm --filter @aspect/shared test:run && pnpm --filter @aspect/shared typecheck`
Expected: all tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add entity domain types and snapshot/update messages"
```

---

## Task 2: Server config for the Home Assistant connection

**Files:**
- Modify (replace): `apps/server/src/config.ts`
- Create: `apps/server/test/config.test.ts`

- [ ] **Step 1: Write the failing test `apps/server/test/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('reads HA url and token from env', () => {
    const cfg = loadConfig({
      HA_URL: 'http://homeassistant.local:8123',
      HA_TOKEN: 'tok123',
    });
    expect(cfg.haUrl).toBe('http://homeassistant.local:8123');
    expect(cfg.haToken).toBe('tok123');
  });

  it('leaves HA fields null when unset', () => {
    const cfg = loadConfig({});
    expect(cfg.haUrl).toBeNull();
    expect(cfg.haToken).toBeNull();
  });

  it('throws on a non-numeric PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aspect/server test:run config`
Expected: FAIL — `haUrl`/`haToken` do not exist on the config.

- [ ] **Step 3: Replace `apps/server/src/config.ts`**

```ts
export interface AspectConfig {
  /** Port the HTTP/WebSocket server listens on. */
  port: number;
  /** Host interface to bind. */
  host: string;
  /** Absolute path to the built web assets, or null in dev. */
  webDir: string | null;
  /** Base URL of the Home Assistant instance (e.g. http://host:8123), or null. */
  haUrl: string | null;
  /** Long-lived access token for Home Assistant, or null. */
  haToken: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AspectConfig {
  const port = env.PORT ? Number.parseInt(env.PORT, 10) : 8099;
  if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT environment variable: "${env.PORT}"`);
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    webDir: env.ASPECT_WEB_DIR ?? null,
    haUrl: env.HA_URL ?? null,
    haToken: env.HA_TOKEN ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run config`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/config.ts apps/server/test/config.test.ts
git commit -m "feat(server): add HA_URL and HA_TOKEN to config"
```

---

## Task 3: Pure normalizers (HA wire shapes → domain types)

**Files:**
- Create: `apps/server/src/ha/normalize.ts`
- Test: `apps/server/test/ha/normalize.test.ts`

- [ ] **Step 1: Write the failing test `apps/server/test/ha/normalize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeEntity,
  normalizeArea,
  normalizeDevice,
  normalizeRegistryEntry,
} from '../../src/ha/normalize.js';

describe('normalizeEntity', () => {
  it('maps HA snake_case fields to camelCase domain shape', () => {
    const result = normalizeEntity({
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 200 },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:01Z',
    });
    expect(result).toEqual({
      entityId: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 200 },
      lastChanged: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:01Z',
    });
  });

  it('defaults missing attributes to an empty object', () => {
    const result = normalizeEntity({
      entity_id: 'sensor.x',
      state: '5',
      last_changed: 't',
      last_updated: 't',
    });
    expect(result.attributes).toEqual({});
  });
});

describe('normalizeArea', () => {
  it('maps area_id and name', () => {
    expect(normalizeArea({ area_id: 'kitchen', name: 'Kitchen' })).toEqual({
      areaId: 'kitchen',
      name: 'Kitchen',
    });
  });
});

describe('normalizeDevice', () => {
  it('prefers name_by_user over name', () => {
    expect(
      normalizeDevice({
        id: 'dev1',
        name: 'Generic Bulb',
        name_by_user: 'Kitchen Bulb',
        area_id: 'kitchen',
      }),
    ).toEqual({ deviceId: 'dev1', name: 'Kitchen Bulb', areaId: 'kitchen' });
  });

  it('falls back to name and null area', () => {
    expect(
      normalizeDevice({ id: 'dev2', name: 'Bulb', name_by_user: null, area_id: null }),
    ).toEqual({ deviceId: 'dev2', name: 'Bulb', areaId: null });
  });
});

describe('normalizeRegistryEntry', () => {
  it('prefers name over original_name', () => {
    expect(
      normalizeRegistryEntry({
        entity_id: 'light.kitchen',
        device_id: 'dev1',
        area_id: null,
        name: 'My Light',
        original_name: 'Light',
        platform: 'hue',
      }),
    ).toEqual({
      entityId: 'light.kitchen',
      deviceId: 'dev1',
      areaId: null,
      name: 'My Light',
      platform: 'hue',
    });
  });

  it('falls back to original_name when name is null', () => {
    const r = normalizeRegistryEntry({
      entity_id: 'light.x',
      device_id: null,
      area_id: 'kitchen',
      name: null,
      original_name: 'Original',
      platform: 'hue',
    });
    expect(r.name).toBe('Original');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aspect/server test:run normalize`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/server/src/ha/normalize.ts`**

```ts
import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
} from '@aspect/shared';

/** Raw HA entity state as delivered by get_states / state_changed events. */
export interface RawHassEntity {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface RawArea {
  area_id: string;
  name: string;
}

export interface RawDevice {
  id: string;
  name: string | null;
  name_by_user?: string | null;
  area_id: string | null;
}

export interface RawRegistryEntry {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  name: string | null;
  original_name?: string | null;
  platform: string;
}

export function normalizeEntity(raw: RawHassEntity): EntityState {
  return {
    entityId: raw.entity_id,
    state: raw.state,
    attributes: raw.attributes ?? {},
    lastChanged: raw.last_changed,
    lastUpdated: raw.last_updated,
  };
}

export function normalizeArea(raw: RawArea): Area {
  return { areaId: raw.area_id, name: raw.name };
}

export function normalizeDevice(raw: RawDevice): Device {
  return {
    deviceId: raw.id,
    name: raw.name_by_user ?? raw.name,
    areaId: raw.area_id,
  };
}

export function normalizeRegistryEntry(raw: RawRegistryEntry): RegistryEntry {
  return {
    entityId: raw.entity_id,
    deviceId: raw.device_id,
    areaId: raw.area_id,
    name: raw.name ?? raw.original_name ?? null,
    platform: raw.platform,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run normalize`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/ha/normalize.ts apps/server/test/ha/normalize.test.ts
git commit -m "feat(server): add pure HA-to-domain normalizers"
```

---

## Task 4: In-memory authoritative cache

**Files:**
- Create: `apps/server/src/cache/haCache.ts`
- Test: `apps/server/test/cache/haCache.test.ts`

- [ ] **Step 1: Write the failing test `apps/server/test/cache/haCache.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { HaCache } from '../../src/cache/haCache.js';
import type { EntityState } from '@aspect/shared';

const entity = (id: string, state: string): EntityState => ({
  entityId: id,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

describe('HaCache', () => {
  it('starts empty', () => {
    const cache = new HaCache();
    const snap = cache.getSnapshot();
    expect(snap.entities).toEqual([]);
    expect(snap.areas).toEqual([]);
  });

  it('stores a snapshot and returns it sorted by entityId', () => {
    const cache = new HaCache();
    cache.setSnapshot({
      entities: [entity('light.b', 'on'), entity('light.a', 'off')],
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    const snap = cache.getSnapshot();
    expect(snap.entities.map((e) => e.entityId)).toEqual(['light.a', 'light.b']);
    expect(snap.areas).toHaveLength(1);
  });

  it('upserts a single entity and reports it as changed', () => {
    const cache = new HaCache();
    cache.setSnapshot({ entities: [entity('light.a', 'off')], areas: [], devices: [], registry: [] });
    const changed = cache.applyEntity(entity('light.a', 'on'));
    expect(changed).toBe(true);
    expect(cache.getSnapshot().entities[0]?.state).toBe('on');
  });

  it('returns false when an upsert does not change anything', () => {
    const cache = new HaCache();
    const e = entity('light.a', 'on');
    cache.applyEntity(e);
    expect(cache.applyEntity({ ...e })).toBe(false);
  });

  it('removes an entity and reports whether it existed', () => {
    const cache = new HaCache();
    cache.applyEntity(entity('light.a', 'on'));
    expect(cache.removeEntity('light.a')).toBe(true);
    expect(cache.removeEntity('light.a')).toBe(false);
    expect(cache.getSnapshot().entities).toEqual([]);
  });

  it('replaces registries without touching entities', () => {
    const cache = new HaCache();
    cache.applyEntity(entity('light.a', 'on'));
    cache.setRegistries({
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [{ deviceId: 'd', name: 'D', areaId: 'k' }],
      registry: [],
    });
    const snap = cache.getSnapshot();
    expect(snap.entities).toHaveLength(1);
    expect(snap.areas).toHaveLength(1);
    expect(snap.devices).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aspect/server test:run haCache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/server/src/cache/haCache.ts`**

```ts
import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
  WorldSnapshot,
} from '@aspect/shared';

/**
 * In-memory authoritative cache of the Home Assistant world. Passive: it has
 * no knowledge of HA or sockets. The connection layer feeds it; the client hub
 * reads snapshots from it. Entities are keyed by entityId for O(1) upserts.
 */
export class HaCache {
  private entities = new Map<string, EntityState>();
  private areas: Area[] = [];
  private devices: Device[] = [];
  private registry: RegistryEntry[] = [];

  setSnapshot(snapshot: WorldSnapshot): void {
    this.entities = new Map(snapshot.entities.map((e) => [e.entityId, e]));
    this.areas = [...snapshot.areas];
    this.devices = [...snapshot.devices];
    this.registry = [...snapshot.registry];
  }

  setRegistries(input: {
    areas: Area[];
    devices: Device[];
    registry: RegistryEntry[];
  }): void {
    this.areas = [...input.areas];
    this.devices = [...input.devices];
    this.registry = [...input.registry];
  }

  /** Upsert one entity. Returns true if the cached value actually changed. */
  applyEntity(entity: EntityState): boolean {
    const existing = this.entities.get(entity.entityId);
    if (existing && shallowEntityEqual(existing, entity)) return false;
    this.entities.set(entity.entityId, entity);
    return true;
  }

  /** Remove one entity. Returns true if it existed. */
  removeEntity(entityId: string): boolean {
    return this.entities.delete(entityId);
  }

  /** A stable, sorted-by-entityId view of the whole world. */
  getSnapshot(): WorldSnapshot {
    const entities = [...this.entities.values()].sort((a, b) =>
      a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0,
    );
    return {
      entities,
      areas: [...this.areas],
      devices: [...this.devices],
      registry: [...this.registry],
    };
  }
}

function shallowEntityEqual(a: EntityState, b: EntityState): boolean {
  return (
    a.state === b.state &&
    a.lastUpdated === b.lastUpdated &&
    a.lastChanged === b.lastChanged &&
    JSON.stringify(a.attributes) === JSON.stringify(b.attributes)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run haCache`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/cache/haCache.ts apps/server/test/cache/haCache.test.ts
git commit -m "feat(server): add in-memory HaCache"
```

---

## Task 5: Wire-accurate mock Home Assistant WebSocket server

**Files:**
- Create: `apps/server/test/helpers/mockHaServer.ts`
- Test: `apps/server/test/helpers/mockHaServer.test.ts`

- [ ] **Step 1: Add `home-assistant-js-websocket` to `apps/server/package.json`**

Add to `dependencies` (keep the existing entries):

```json
    "home-assistant-js-websocket": "9.4.0"
```

Then run: `pnpm install`
Expected: installs with no errors.

- [ ] **Step 2: Implement `apps/server/test/helpers/mockHaServer.ts`**

```ts
import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { RawHassEntity } from '../../src/ha/normalize.js';

export interface MockHaOptions {
  token: string;
  states?: RawHassEntity[];
  areas?: unknown[];
  devices?: unknown[];
  entityRegistry?: unknown[];
}

/**
 * A minimal but wire-accurate Home Assistant WebSocket server, good enough for
 * `home-assistant-js-websocket` to authenticate, fetch states + registries, and
 * subscribe to events. Unknown commands are acked with an empty success result
 * so the mock survives library version differences (e.g. supported_features).
 */
export class MockHaServer {
  private wss: WebSocketServer;
  private sockets = new Set<WebSocket>();
  /** Subscription id used by the client for state_changed events. */
  private stateChangedSubId: number | null = null;

  private constructor(
    private readonly opts: MockHaOptions,
    port: number,
  ) {
    this.wss = new WebSocketServer({ port, path: '/api/websocket' });
    this.wss.on('connection', (socket) => this.handleConnection(socket));
  }

  static async start(opts: MockHaOptions): Promise<MockHaServer> {
    const server = new MockHaServer(opts, 0);
    await new Promise<void>((resolve) => server.wss.once('listening', resolve));
    return server;
  }

  /** Base HTTP url for createLongLivedTokenAuth, e.g. http://127.0.0.1:PORT */
  get url(): string {
    const { port } = this.wss.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  /** Push a state_changed event to all subscribed clients. */
  emitStateChanged(
    entityId: string,
    newState: RawHassEntity | null,
    oldState: RawHassEntity | null = null,
  ): void {
    if (this.stateChangedSubId === null) return;
    const event = {
      id: this.stateChangedSubId,
      type: 'event',
      event: {
        event_type: 'state_changed',
        data: { entity_id: entityId, new_state: newState, old_state: oldState },
        time_fired: new Date().toISOString(),
        origin: 'LOCAL',
      },
    };
    for (const socket of this.sockets) socket.send(JSON.stringify(event));
  }

  async stop(): Promise<void> {
    for (const s of this.sockets) s.close();
    await new Promise<void>((resolve, reject) =>
      this.wss.close((err) => (err ? reject(err) : resolve())),
    );
  }

  private handleConnection(socket: WebSocket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.1.0' }));

    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      this.handleMessage(socket, msg);
    });
  }

  private handleMessage(
    socket: WebSocket,
    msg: Record<string, unknown>,
  ): void {
    const send = (obj: unknown): void => socket.send(JSON.stringify(obj));
    const id = msg.id as number | undefined;

    if (msg.type === 'auth') {
      if (msg.access_token === this.opts.token) {
        send({ type: 'auth_ok', ha_version: '2026.1.0' });
      } else {
        send({ type: 'auth_invalid', message: 'bad token' });
      }
      return;
    }

    const result = (value: unknown): void =>
      send({ id, type: 'result', success: true, result: value });

    switch (msg.type) {
      case 'get_states':
        result(this.opts.states ?? []);
        return;
      case 'config/area_registry/list':
        result(this.opts.areas ?? []);
        return;
      case 'config/device_registry/list':
        result(this.opts.devices ?? []);
        return;
      case 'config/entity_registry/list':
        result(this.opts.entityRegistry ?? []);
        return;
      case 'subscribe_events':
        if (msg.event_type === 'state_changed' && typeof id === 'number') {
          this.stateChangedSubId = id;
        }
        result(null);
        return;
      case 'ping':
        send({ id, type: 'pong' });
        return;
      default:
        // Ack anything else (supported_features, other subscriptions, etc.)
        if (typeof id === 'number') result(null);
        return;
    }
  }
}
```

- [ ] **Step 3: Write the test `apps/server/test/helpers/mockHaServer.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  createConnection,
  createLongLivedTokenAuth,
  getStates,
  type Connection,
} from 'home-assistant-js-websocket';
import { MockHaServer } from './mockHaServer.js';

let mock: MockHaServer | undefined;
let conn: Connection | undefined;

afterEach(async () => {
  conn?.close();
  conn = undefined;
  await mock?.stop();
  mock = undefined;
});

describe('MockHaServer', () => {
  it('lets home-assistant-js-websocket authenticate and fetch states', async () => {
    mock = await MockHaServer.start({
      token: 'secret',
      states: [
        {
          entity_id: 'light.kitchen',
          state: 'on',
          attributes: {},
          last_changed: 't',
          last_updated: 't',
        },
      ],
    });
    const auth = createLongLivedTokenAuth(mock.url, 'secret');
    conn = await createConnection({ auth });
    const states = await getStates(conn);
    expect(states).toHaveLength(1);
    expect(states[0]?.entity_id).toBe('light.kitchen');
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run mockHaServer`
Expected: PASS (1 test).

> **Integration note for the implementer:** `home-assistant-js-websocket` relies on a global `WebSocket`, which Node 22 provides. If this test fails during the auth handshake because the library sends an extra setup message the mock doesn't recognize, the `default` branch already acks any id-bearing command with an empty success result — confirm the failing message has an `id`; if it does not and the library waits for a specific reply, add an explicit `case` for it. Do not change the public mock API.

- [ ] **Step 5: Commit**

```bash
git add apps/server/package.json apps/server/test/helpers/mockHaServer.ts apps/server/test/helpers/mockHaServer.test.ts pnpm-lock.yaml
git commit -m "test(server): add wire-accurate mock Home Assistant server"
```

---

## Task 6: Generalize the WebSocket hub into ClientHub

This renames `StatusHub`/`statusChannel` to `ClientHub`/`clientChannel`, gives the hub access to the cache, greets each new client with a snapshot, and adds entity-update/snapshot broadcasts. The decoration becomes `app.clientHub` (still `fastify-plugin`-wrapped so it reaches the root instance), and `app.haCache` is also exposed for the connection layer.

**Files:**
- Create: `apps/server/src/ws/clientChannel.ts`
- Delete: `apps/server/src/ws/statusChannel.ts`
- Modify (replace): `apps/server/src/app.ts`
- Create: `apps/server/test/clientChannel.test.ts`
- Delete: `apps/server/test/statusChannel.test.ts`

- [ ] **Step 1: Remove the old files**

```bash
git rm apps/server/src/ws/statusChannel.ts apps/server/test/statusChannel.test.ts
```

- [ ] **Step 2: Create `apps/server/src/ws/clientChannel.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { WebSocket } from '@fastify/websocket';
import {
  createStatusMessage,
  createSnapshotMessage,
  createEntityUpdateMessage,
  type EntityState,
  type ServerStatus,
  type ServerToClientMessage,
} from '@aspect/shared';
import type { HaCache } from '../cache/haCache.js';

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

  constructor(private readonly cache: HaCache) {}

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    this.send(socket, createStatusMessage(this.status, this.haConnected));
    this.send(socket, createSnapshotMessage(this.cache.getSnapshot()));
  }

  setStatus(status: ServerStatus, haConnected: boolean): void {
    this.status = status;
    this.haConnected = haConnected;
    this.broadcast(createStatusMessage(status, haConnected));
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
    const hub = new ClientHub(opts.cache);
    app.decorate('clientHub', hub);
    app.decorate('haCache', opts.cache);
    app.get('/ws', { websocket: true }, (socket) => {
      hub.add(socket);
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
```

- [ ] **Step 3: Replace `apps/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { clientChannel } from './ws/clientChannel.js';
import { registerStatic } from './static.js';
import { HaCache } from './cache/haCache.js';

export interface BuildAppOptions {
  webDir?: string | null;
  /** Inject a cache (tests); a fresh one is created when omitted. */
  cache?: HaCache;
}

export async function buildApp(
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const cache = opts.cache ?? new HaCache();
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);
  await app.register(healthRoutes);
  await app.register(clientChannel, { cache });
  await registerStatic(app, opts.webDir ?? null);
  return app;
}
```

- [ ] **Step 4: Create `apps/server/test/clientChannel.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import {
  isServerToClientMessage,
  type ServerToClientMessage,
} from '@aspect/shared';
import { buildApp } from '../src/app.js';
import { HaCache } from '../src/cache/haCache.js';
import { listen } from './helpers/wsTestClient.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Collect the first `count` parsed messages from a ws connection. */
function collect(url: string, count: number): Promise<ServerToClientMessage[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const msgs: ServerToClientMessage[] = [];
    socket.on('message', (data) => {
      msgs.push(JSON.parse(data.toString()) as ServerToClientMessage);
      if (msgs.length === count) {
        socket.close();
        resolve(msgs);
      }
    });
    socket.on('error', reject);
  });
}

describe('GET /ws (ClientHub)', () => {
  it('greets a new client with a status then a snapshot', async () => {
    const cache = new HaCache();
    cache.setSnapshot({
      entities: [
        {
          entityId: 'light.kitchen',
          state: 'on',
          attributes: {},
          lastChanged: 't',
          lastUpdated: 't',
        },
      ],
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    app = await buildApp({ cache });
    const base = await listen(app);
    const [first, second] = await collect(`${base}/ws`, 2);
    expect(isServerToClientMessage(first)).toBe(true);
    expect(first?.type).toBe('status');
    expect(second?.type).toBe('snapshot');
    if (second?.type === 'snapshot') {
      expect(second.entities).toHaveLength(1);
      expect(second.areas[0]?.name).toBe('Kitchen');
    }
  });

  it('broadcasts an entity update to a connected client', async () => {
    const cache = new HaCache();
    app = await buildApp({ cache });
    const base = await listen(app);
    const socket = new WebSocket(`${base}/ws`);
    const msgs: ServerToClientMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      socket.on('message', (data) => {
        msgs.push(JSON.parse(data.toString()) as ServerToClientMessage);
        // After the initial status + snapshot, push an entity update.
        if (msgs.length === 2) {
          app!.clientHub.broadcastEntityUpdate([
            {
              entityId: 'light.kitchen',
              state: 'on',
              attributes: {},
              lastChanged: 't',
              lastUpdated: 't',
            },
          ]);
        }
        if (msgs.length === 3) resolve();
      });
      socket.on('error', reject);
    });
    socket.close();

    expect(msgs[2]?.type).toBe('entity_update');
    if (msgs[2]?.type === 'entity_update') {
      expect(msgs[2].entities[0]?.entityId).toBe('light.kitchen');
    }
  });
});
```

- [ ] **Step 5: Run the server tests and typecheck**

Run: `pnpm --filter @aspect/server test:run && pnpm --filter @aspect/server typecheck`
Expected: all server tests pass (config, normalize, haCache, mockHaServer, clientChannel); no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/ws/clientChannel.ts apps/server/src/app.ts apps/server/test/clientChannel.test.ts
git commit -m "refactor(server): generalize StatusHub into cache-aware ClientHub"
```

---

## Task 7: Home Assistant connection layer

Wires `home-assistant-js-websocket` to the cache and hub: authenticates, loads initial states + registries, subscribes to `state_changed` and registry-update events, and drives status. `startHaConnection` returns a handle with a `stop()` for clean shutdown.

**Files:**
- Create: `apps/server/src/ha/connection.ts`
- Test: `apps/server/test/ha/connection.test.ts`

- [ ] **Step 1: Implement `apps/server/src/ha/connection.ts`**

```ts
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

  connection.addEventListener('ready', () => {
    void loadEverything(connection, cache, hub);
  });
  connection.addEventListener('disconnected', () => {
    hub.setStatus('degraded', false);
  });

  await loadEverything(connection, cache, hub);

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
```

- [ ] **Step 2: Write the integration test `apps/server/test/ha/connection.test.ts`**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MockHaServer } from '../helpers/mockHaServer.js';
import { HaCache } from '../../src/cache/haCache.js';
import { ClientHub } from '../../src/ws/clientChannel.js';
import { startHaConnection, type HaConnectionHandle } from '../../src/ha/connection.js';

let mock: MockHaServer | undefined;
let handle: HaConnectionHandle | undefined;

afterEach(async () => {
  handle?.stop();
  handle = undefined;
  await mock?.stop();
  mock = undefined;
});

describe('startHaConnection', () => {
  it('loads states + registries into the cache and goes online', async () => {
    mock = await MockHaServer.start({
      token: 'secret',
      states: [
        {
          entity_id: 'light.kitchen',
          state: 'on',
          attributes: { brightness: 200 },
          last_changed: 't',
          last_updated: 't',
        },
      ],
      areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
      devices: [{ id: 'd1', name: 'Bulb', name_by_user: null, area_id: 'kitchen' }],
      entityRegistry: [
        {
          entity_id: 'light.kitchen',
          device_id: 'd1',
          area_id: null,
          name: null,
          original_name: 'Kitchen Light',
          platform: 'demo',
        },
      ],
    });
    const cache = new HaCache();
    const hub = new ClientHub(cache);
    handle = await startHaConnection({
      url: mock.url,
      token: 'secret',
      cache,
      hub,
    });

    const snap = cache.getSnapshot();
    expect(snap.entities.map((e) => e.entityId)).toEqual(['light.kitchen']);
    expect(snap.areas[0]?.name).toBe('Kitchen');
    expect(snap.registry[0]?.name).toBe('Kitchen Light');
  });

  it('applies a live state_changed event to the cache', async () => {
    mock = await MockHaServer.start({ token: 'secret', states: [] });
    const cache = new HaCache();
    const hub = new ClientHub(cache);
    handle = await startHaConnection({ url: mock.url, token: 'secret', cache, hub });

    mock.emitStateChanged('switch.fan', {
      entity_id: 'switch.fan',
      state: 'on',
      attributes: {},
      last_changed: 't',
      last_updated: 't',
    });

    // Allow the event to round-trip.
    await vi.waitFor(() => {
      expect(cache.getSnapshot().entities.map((e) => e.entityId)).toContain(
        'switch.fan',
      );
    });
  });
});
```

- [ ] **Step 3: Run the integration test**

Run: `pnpm --filter @aspect/server test:run connection`
Expected: PASS (2 tests).

> **Integration note:** If `subscribeEvents` for the registry event names rejects against the mock (the mock acks them via its default branch, so it should not), or if the library's `sendMessagePromise` for a registry list hangs, confirm the mock returns a `result` for that command id. The mock's default branch already does this.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/ha/connection.ts apps/server/test/ha/connection.test.ts
git commit -m "feat(server): add Home Assistant connection wiring cache + hub"
```

---

## Task 8: Full-stack fan-out and server startup

Wire the HA connection into `server.ts` so a configured server connects on boot, and prove the whole pipe end-to-end: mock HA → Aspect server → browser-style ws client receives a snapshot, then a live update.

**Files:**
- Modify (replace): `apps/server/src/server.ts`
- Create: `apps/server/test/fanout.test.ts`

- [ ] **Step 1: Replace `apps/server/src/server.ts`**

```ts
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { startHaConnection } from './ha/connection.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ webDir: config.webDir });
  await app.listen({ port: config.port, host: config.host });
  // eslint-disable-next-line no-console
  console.log(`Aspect server listening on http://${config.host}:${config.port}`);

  if (config.haUrl && config.haToken) {
    try {
      await startHaConnection({
        url: config.haUrl,
        token: config.haToken,
        cache: app.haCache,
        hub: app.clientHub,
      });
      // eslint-disable-next-line no-console
      console.log(`Connected to Home Assistant at ${config.haUrl}`);
    } catch (err) {
      app.clientHub.setStatus('degraded', false);
      // eslint-disable-next-line no-console
      console.error('Failed to connect to Home Assistant:', err);
    }
  } else {
    app.clientHub.setStatus('degraded', false);
    // eslint-disable-next-line no-console
    console.warn(
      'HA_URL/HA_TOKEN not set — running without a Home Assistant connection.',
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Write the full-stack test `apps/server/test/fanout.test.ts`**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { ServerToClientMessage } from '@aspect/shared';
import { buildApp } from '../src/app.js';
import { HaCache } from '../src/cache/haCache.js';
import { startHaConnection, type HaConnectionHandle } from '../src/ha/connection.js';
import { MockHaServer } from './helpers/mockHaServer.js';
import { listen } from './helpers/wsTestClient.js';

let app: FastifyInstance | undefined;
let mock: MockHaServer | undefined;
let handle: HaConnectionHandle | undefined;

afterEach(async () => {
  handle?.stop();
  handle = undefined;
  await mock?.stop();
  mock = undefined;
  await app?.close();
  app = undefined;
});

describe('end-to-end fan-out', () => {
  it('delivers HA state to a web client as snapshot then live update', async () => {
    mock = await MockHaServer.start({
      token: 'secret',
      states: [
        {
          entity_id: 'light.kitchen',
          state: 'off',
          attributes: {},
          last_changed: 't',
          last_updated: 't',
        },
      ],
    });
    const cache = new HaCache();
    app = await buildApp({ cache });
    const base = await listen(app);
    handle = await startHaConnection({
      url: mock.url,
      token: 'secret',
      cache,
      hub: app.clientHub,
    });

    const received: ServerToClientMessage[] = [];
    const socket = new WebSocket(`${base}/ws`);
    socket.on('message', (data) =>
      received.push(JSON.parse(data.toString()) as ServerToClientMessage),
    );
    await new Promise<void>((resolve) => socket.on('open', resolve));

    // The client should get a snapshot containing the initial light.
    await vi.waitFor(() => {
      const snap = received.find((m) => m.type === 'snapshot');
      expect(snap?.type).toBe('snapshot');
      if (snap?.type === 'snapshot') {
        expect(snap.entities.some((e) => e.entityId === 'light.kitchen')).toBe(
          true,
        );
      }
    });

    // A live change in HA should arrive as an entity_update.
    mock.emitStateChanged('light.kitchen', {
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 255 },
      last_changed: 't2',
      last_updated: 't2',
    });

    await vi.waitFor(() => {
      const update = received.find(
        (m) =>
          m.type === 'entity_update' &&
          m.entities.some((e) => e.entityId === 'light.kitchen' && e.state === 'on'),
      );
      expect(update).toBeDefined();
    });

    socket.close();
  });
});
```

- [ ] **Step 3: Run the full server suite, typecheck, and build**

Run: `pnpm --filter @aspect/server test:run && pnpm --filter @aspect/server typecheck && pnpm --filter @aspect/server build`
Expected: all tests pass; no type errors; bundle builds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/server.ts apps/server/test/fanout.test.ts
git commit -m "feat(server): connect to HA on startup and fan state out to clients"
```

---

## Task 9: Client consumes snapshot and updates

Extend the web store and message handler to apply snapshots/updates, and surface a live count in `App` so the whole pipe is visible. (The real dashboard is Plan 3 — this is just proof-of-life.)

**Files:**
- Modify (replace): `apps/web/src/store/connectionStore.ts`
- Modify (replace): `apps/web/src/store/connectionStore.test.ts`
- Modify (replace): `apps/web/src/server-client/messageHandler.ts`
- Modify (replace): `apps/web/src/server-client/messageHandler.test.ts`
- Modify (replace): `apps/web/src/App.tsx`
- Modify (replace): `apps/web/src/App.test.tsx`

- [ ] **Step 1: Replace `apps/web/src/store/connectionStore.ts`**

```ts
import { create } from 'zustand';
import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
  ServerStatus,
} from '@aspect/shared';

/** Whether the browser currently holds a socket to the Aspect server. */
export type LinkState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  link: LinkState;
  serverStatus: ServerStatus | null;
  haConnected: boolean;
  entities: Record<string, EntityState>;
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
  setLink: (link: LinkState) => void;
  applyStatus: (status: ServerStatus, haConnected: boolean) => void;
  applySnapshot: (snapshot: {
    entities: EntityState[];
    areas: Area[];
    devices: Device[];
    registry: RegistryEntry[];
  }) => void;
  applyEntityUpdate: (entities: EntityState[], removed: string[]) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  link: 'disconnected',
  serverStatus: null,
  haConnected: false,
  entities: {},
  areas: [],
  devices: [],
  registry: [],
  setLink: (link) => set({ link }),
  applyStatus: (serverStatus, haConnected) => set({ serverStatus, haConnected }),
  applySnapshot: (snapshot) =>
    set({
      entities: Object.fromEntries(
        snapshot.entities.map((e) => [e.entityId, e]),
      ),
      areas: snapshot.areas,
      devices: snapshot.devices,
      registry: snapshot.registry,
    }),
  applyEntityUpdate: (entities, removed) =>
    set((state) => {
      const next = { ...state.entities };
      for (const e of entities) next[e.entityId] = e;
      for (const id of removed) delete next[id];
      return { entities: next };
    }),
}));
```

- [ ] **Step 2: Replace `apps/web/src/store/connectionStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './connectionStore.js';
import type { EntityState } from '@aspect/shared';

const reset = (): void =>
  useConnectionStore.setState({
    link: 'disconnected',
    serverStatus: null,
    haConnected: false,
    entities: {},
    areas: [],
    devices: [],
    registry: [],
  });

const entity = (id: string, state: string): EntityState => ({
  entityId: id,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

describe('connectionStore', () => {
  beforeEach(reset);

  it('starts disconnected and empty', () => {
    const s = useConnectionStore.getState();
    expect(s.link).toBe('disconnected');
    expect(s.serverStatus).toBeNull();
    expect(s.areas).toEqual([]);
  });

  it('updates link and status', () => {
    useConnectionStore.getState().setLink('connected');
    useConnectionStore.getState().applyStatus('online', true);
    const s = useConnectionStore.getState();
    expect(s.link).toBe('connected');
    expect(s.serverStatus).toBe('online');
    expect(s.haConnected).toBe(true);
  });

  it('applies a snapshot keyed by entityId', () => {
    useConnectionStore.getState().applySnapshot({
      entities: [entity('light.a', 'on'), entity('light.b', 'off')],
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    const s = useConnectionStore.getState();
    expect(Object.keys(s.entities)).toHaveLength(2);
    expect(s.entities['light.a']?.state).toBe('on');
    expect(s.areas).toHaveLength(1);
  });

  it('applies entity updates and removals', () => {
    useConnectionStore.getState().applySnapshot({
      entities: [entity('light.a', 'on')],
      areas: [],
      devices: [],
      registry: [],
    });
    useConnectionStore.getState().applyEntityUpdate([entity('light.a', 'off')], []);
    expect(useConnectionStore.getState().entities['light.a']?.state).toBe('off');
    useConnectionStore.getState().applyEntityUpdate([], ['light.a']);
    expect(useConnectionStore.getState().entities['light.a']).toBeUndefined();
  });
});
```

- [ ] **Step 3: Replace `apps/web/src/server-client/messageHandler.ts`**

```ts
import { isServerToClientMessage } from '@aspect/shared';
import { useConnectionStore } from '../store/connectionStore.js';

/**
 * Parses a raw socket payload and applies it to the store. Pure with respect
 * to the socket: safe to unit-test without a live connection. Silently ignores
 * anything that is not a recognized server message.
 */
export function handleRawMessage(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isServerToClientMessage(parsed)) return;

  const store = useConnectionStore.getState();
  switch (parsed.type) {
    case 'status':
      store.applyStatus(parsed.status, parsed.haConnected);
      return;
    case 'snapshot':
      store.applySnapshot({
        entities: parsed.entities,
        areas: parsed.areas,
        devices: parsed.devices,
        registry: parsed.registry,
      });
      return;
    case 'entity_update':
      store.applyEntityUpdate(parsed.entities, parsed.removed);
      return;
  }
}
```

- [ ] **Step 4: Replace `apps/web/src/server-client/messageHandler.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { handleRawMessage } from './messageHandler.js';
import { useConnectionStore } from '../store/connectionStore.js';
import {
  createStatusMessage,
  createSnapshotMessage,
  createEntityUpdateMessage,
  type EntityState,
} from '@aspect/shared';

const entity = (id: string, state: string): EntityState => ({
  entityId: id,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

describe('handleRawMessage', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      link: 'connected',
      serverStatus: null,
      haConnected: false,
      entities: {},
      areas: [],
      devices: [],
      registry: [],
    });
  });

  it('applies a status message', () => {
    handleRawMessage(JSON.stringify(createStatusMessage('degraded', true)));
    const s = useConnectionStore.getState();
    expect(s.serverStatus).toBe('degraded');
    expect(s.haConnected).toBe(true);
  });

  it('applies a snapshot message', () => {
    handleRawMessage(
      JSON.stringify(
        createSnapshotMessage({
          entities: [entity('light.a', 'on')],
          areas: [{ areaId: 'k', name: 'Kitchen' }],
          devices: [],
          registry: [],
        }),
      ),
    );
    expect(Object.keys(useConnectionStore.getState().entities)).toHaveLength(1);
  });

  it('applies an entity_update message', () => {
    handleRawMessage(
      JSON.stringify(createSnapshotMessage({
        entities: [entity('light.a', 'on')],
        areas: [],
        devices: [],
        registry: [],
      })),
    );
    handleRawMessage(JSON.stringify(createEntityUpdateMessage([entity('light.a', 'off')])));
    expect(useConnectionStore.getState().entities['light.a']?.state).toBe('off');
  });

  it('ignores invalid json and unknown messages without throwing', () => {
    expect(() => handleRawMessage('not json')).not.toThrow();
    handleRawMessage(JSON.stringify({ type: 'mystery' }));
    expect(useConnectionStore.getState().serverStatus).toBeNull();
  });
});
```

- [ ] **Step 5: Replace `apps/web/src/App.tsx`**

```tsx
import { useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { connectToServer } from './server-client/socket.js';
import { useConnectionStore } from './store/connectionStore.js';

export function App(): ReactElement {
  const link = useConnectionStore((s) => s.link);
  const serverStatus = useConnectionStore((s) => s.serverStatus);
  const haConnected = useConnectionStore((s) => s.haConnected);
  const entityCount = useConnectionStore((s) => Object.keys(s.entities).length);
  const areaCount = useConnectionStore((s) => s.areas.length);

  useEffect(() => connectToServer(), []);

  const connected = link === 'connected' && serverStatus !== null;
  const label = !connected ? 'Connecting…' : `Server ${serverStatus}`;
  const accent =
    serverStatus === 'online'
      ? '#3ddc84'
      : serverStatus === 'degraded'
        ? '#ffb84d'
        : '#8a8a93';

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#16161a',
        color: '#f3f3f5',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 22px',
              borderRadius: 999,
              background: '#1f1f25',
              border: '1px solid #2a2a31',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{ width: 10, height: 10, borderRadius: '50%', background: accent }}
            />
            {label}
            {haConnected ? ' · HA linked' : ''}
          </motion.div>
        </AnimatePresence>

        {connected && (
          <p style={{ margin: 0, fontSize: 14, color: '#a9a7b3' }}>
            {entityCount} entities · {areaCount} areas
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Replace `apps/web/src/App.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from './App.js';
import { useConnectionStore } from './store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

vi.mock('./server-client/socket.js', () => ({
  connectToServer: () => () => undefined,
}));

const entity = (id: string): EntityState => ({
  entityId: id,
  state: 'on',
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

describe('App', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      link: 'disconnected',
      serverStatus: null,
      haConnected: false,
      entities: {},
      areas: [],
      devices: [],
      registry: [],
    });
  });

  it('shows a connecting state before any status arrives', () => {
    render(<App />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows status and live counts once received', async () => {
    render(<App />);
    act(() => {
      useConnectionStore.getState().setLink('connected');
      useConnectionStore.getState().applyStatus('online', true);
      useConnectionStore.getState().applySnapshot({
        entities: [entity('light.a'), entity('light.b')],
        areas: [{ areaId: 'k', name: 'Kitchen' }],
        devices: [],
        registry: [],
      });
    });
    expect(await screen.findByText(/online/i)).toBeInTheDocument();
    expect(screen.getByText(/2 entities/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the web suite, typecheck, and build**

Run: `pnpm --filter @aspect/web test:run && pnpm --filter @aspect/web typecheck && pnpm --filter @aspect/web build`
Expected: all tests pass; no type errors; build emits `dist`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): consume snapshot/update messages and show live counts"
```

---

## Task 10: End-to-end verification against a fake HA

There is no live Home Assistant here, so verify against the mock by running a tiny throwaway script, then confirm the whole suite + CI commands pass.

**Files:** none committed (a throwaway script is created then deleted)

- [ ] **Step 1: Run the full workspace verification (what CI runs)**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:run && pnpm build`
Expected: every step exits 0; total tests across shared/server/web all pass.

- [ ] **Step 2: Smoke the end-to-end pipe via the fan-out test**

There is no live Home Assistant here, so the `fanout` integration test is the authoritative end-to-end proof (mock HA → Aspect server → ws client receiving a snapshot then a live update).

Run: `pnpm --filter @aspect/server test:run fanout`
Expected: PASS.

- [ ] **Step 3: Confirm a clean tree**

Run: `git status --short`
Expected: empty (no stray temp files).

- [ ] **Step 4: No commit** (verification only). Fix any failure in the owning task before finishing.

---

## Definition of Done

- [ ] `pnpm typecheck` passes across all packages.
- [ ] `pnpm test:run` passes: shared, server (config, normalize, haCache, mockHaServer, clientChannel, connection, fanout), web (store, messageHandler, App).
- [ ] `pnpm build` produces both bundles.
- [ ] The `fanout` integration test proves: mock HA → Aspect server → ws client receives a `snapshot` then a live `entity_update`.
- [ ] Status reflects real HA state: `online`/`haConnected:true` on connect, `degraded`/`false` on disconnect or when unconfigured.
- [ ] The server still boots and serves the PWA when `HA_URL`/`HA_TOKEN` are unset (graceful degraded mode).

## Notes for the Next Plan (Plan 3 — Dashboard)

- The client store now holds `entities` (keyed), `areas`, `devices`, and `registry`. Plan 3's auto-generation groups entities into rooms by joining `registry` (entity→area, or entity→device→area) against `areas`, then renders the calm room dashboard and detail sheets.
- `home-assistant-js-websocket` is connected server-side; service calls (turning lights on, etc.) will be added in Plan 4 via `callService` on the server connection, exposed through a new client→server message (`HelloMessage`'s `ClientToServerMessage` union is the place to add command messages).
- Auth is still a long-lived token from env. Plan 6 replaces this with the add-on auto-token + "Log in with Home Assistant" OAuth flow.
