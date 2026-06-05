import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isServerToClientMessage } from '@aspect/shared';
import { buildApp } from '../src/app.js';
import { listen, firstMessage } from './helpers/wsTestClient.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /ws', () => {
  it('sends a status message immediately on connect', async () => {
    app = await buildApp();
    const base = await listen(app);
    const msg = await firstMessage(`${base}/ws`);
    expect(isServerToClientMessage(msg)).toBe(true);
    expect((msg as { type: string }).type).toBe('status');
  });
});
