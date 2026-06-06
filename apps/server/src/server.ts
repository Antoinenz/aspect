import { loadConfig } from './config.js';
import { startServer } from './start.js';

startServer(loadConfig()).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
