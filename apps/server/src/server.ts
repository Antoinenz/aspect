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
      const ha = await startHaConnection({
        url: config.haUrl,
        token: config.haToken,
        cache: app.haCache,
        hub: app.clientHub,
      });
      // Stop the HA socket when the server shuts down so it doesn't keep
      // reconnecting headlessly after the process is asked to stop.
      app.addHook('onClose', async () => ha.stop());
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
