import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startServer } from '../src/start.js';

let app: FastifyInstance | undefined;

beforeEach(() => {
  // Silence the expected "no HA configured" warning/log noise.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
});

describe('startServer', () => {
  it('starts (no HA) without throwing and serves /health', async () => {
    // Regression: the onClose hook must be registered BEFORE listen, otherwise
    // Fastify throws FST_ERR_INSTANCE_ALREADY_LISTENING during startup.
    app = await startServer({
      port: 0,
      host: '127.0.0.1',
      webDir: null,
      haUrl: null,
      haToken: null,
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('closes cleanly (onClose hook runs without error)', async () => {
    app = await startServer({
      port: 0,
      host: '127.0.0.1',
      webDir: null,
      haUrl: null,
      haToken: null,
    });
    await expect(app.close()).resolves.toBeUndefined();
    app = undefined;
  });
});
