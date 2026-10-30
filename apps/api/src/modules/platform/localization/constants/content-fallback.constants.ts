import { CONFIG_POLL_INTERVAL_MS } from '@api/infrastructure/configuration/configuration.constants';

/**
 * How often the queue writes the gaps readers met (task 76; `architecture.md` §12.5.6's task-76 row (5)) — the store's
 * own poll, five seconds: a gap a reader met reaches the queue no later than a publication reaches a replica. Neither
 * 182/38 nor FR-64 states an interval; a row is a work item read by a person on A-03, so seconds are exact enough.
 */
export const CONTENT_FALLBACK_WRITE_INTERVAL_MS = CONFIG_POLL_INTERVAL_MS;
