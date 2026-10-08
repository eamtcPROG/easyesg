import { SetMetadata } from '@nestjs/common';

/**
 * A job that runs once a day, at a wall-clock time in a zone (task 51.2; `architecture.md` §12.5.6's task-51.2 row (1)).
 *
 * **Declared beside the job's `@HandlesJob`, on the handler that does the work**, so the module that owns a scheduled
 * job owns its schedule as it owns its routing, and `ScheduleTicker` names no module — the shape `OutboxConsumer`'s
 * discovery already gives a job's routing.
 *
 * **A wall-clock time in a named zone, never an offset**: 07:00 in Chișinău is 05:00 UTC in summer and 04:00 in winter,
 * and a job that reaches people should not move an hour twice a year.
 */
export interface DailySlot {
  /** `HH:MM`, 24-hour, the time on the zone's wall clock at which the day's run opens. */
  readonly at: string;
  /** An IANA zone — the one whose calendar decides which day a run is for. */
  readonly timezone: string;
}

export const RUNS_DAILY_METADATA = 'easyesg:runs-daily';

/** Marks a `@HandlesJob` provider as run once a day by `ScheduleTicker`, which writes its outbox row. */
export const RunsDaily = (slot: DailySlot) => SetMetadata(RUNS_DAILY_METADATA, slot);
