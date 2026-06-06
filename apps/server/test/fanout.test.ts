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
