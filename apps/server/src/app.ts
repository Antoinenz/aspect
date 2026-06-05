import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { statusChannel } from './ws/statusChannel.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);
  await app.register(healthRoutes);
  await app.register(statusChannel);
  return app;
}
