import { CONNECTION, type Connection } from '@/features/wizard/tools/autosave-state';

/**
 * Whether *use these figures in B3* may record a run now, and if not, the one reason a reader is told (task 39.2;
 * §12.5.6's task-39 row (2)).
 *
 * **The run is a direct request and needs a connection**, never queued: it is not idempotent and its figures are the
 * server's. **It waits for the queue**: a run copies the lines the server holds, so a line still waiting to be sent
 * would be left out of the figures B3 receives — the button says so rather than recording a run that misses it. The
 * order is the order the reasons are worth reading in: a screen nobody may write to says that before anything else.
 */
export const RUN_STANDING = {
  READY: 'ready',
  READ_ONLY: 'read_only',
  NO_FACTOR_SET: 'no_factor_set',
  NO_LINES: 'no_lines',
  OFFLINE: 'offline',
  UNSENT: 'unsent',
  UNCOVERED: 'uncovered',
} as const;

export type RunStanding = (typeof RUN_STANDING)[keyof typeof RUN_STANDING];

export function runStanding(input: {
  readonly readOnly: boolean;
  readonly hasFactorSet: boolean;
  readonly lines: number;
  readonly connection: Connection;
  /** Whether the wizard's queue holds anything not yet acknowledged. */
  readonly unsynced: boolean;
  /** Lines the set in force no longer covers — the run refuses them. */
  readonly uncovered: number;
}): RunStanding {
  if (input.readOnly) return RUN_STANDING.READ_ONLY;
  if (!input.hasFactorSet) return RUN_STANDING.NO_FACTOR_SET;
  if (input.lines === 0) return RUN_STANDING.NO_LINES;
  if (input.connection === CONNECTION.OFFLINE) return RUN_STANDING.OFFLINE;
  if (input.unsynced) return RUN_STANDING.UNSENT;
  if (input.uncovered > 0) return RUN_STANDING.UNCOVERED;
  return RUN_STANDING.READY;
}
