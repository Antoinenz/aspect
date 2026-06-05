import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

/** Starts the app on an ephemeral port and returns its base ws URL. */
export async function listen(app: FastifyInstance): Promise<string> {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  // address looks like http://127.0.0.1:54321
  return address.replace('http://', 'ws://');
}

/** Opens a ws connection and resolves with the first parsed JSON message. */
export function firstMessage(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.on('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      } finally {
        socket.close();
      }
    });
    socket.on('error', reject);
  });
}
