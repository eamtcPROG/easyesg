import { rendererConfig } from './renderer-config.js';
import { rendererServer } from './renderer-server.js';

/**
 * The renderer's entrypoint (architecture.md §5: its own container, memory-capped and independently restartable, so
 * Chromium's failures stay its own). It holds no state and needs none: every render launches its own browser, and a
 * stop answers the renders in flight with the connection closing, which the worker retries.
 */
const config = rendererConfig(process.env);
const server = rendererServer(config);
server.listen(config.port, () => console.log(`The renderer is listening on ${config.port}.`));
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
