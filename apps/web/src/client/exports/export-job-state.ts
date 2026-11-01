import { EXPORT_STATUS, type Export } from '@easyesg/contracts';
import { POLL_INTERVAL, nextPollDelay } from '@/client/polling/poll-schedule';

/**
 * What S-11's watch knows about one export (task 47.3; UX-46): the export as last read, and how many polls in a row
 * could not read it — so a failing poll keeps what it knew and backs off on OQ-36's schedule rather than blanking the
 * card.
 */
export interface ExportJobState {
  readonly export: Export;
  readonly failures: number;
}

export const settleExportJob = (input: {
  readonly previous: ExportJobState;
  /** What this poll read — `null` when it could not. */
  readonly read: Export | null;
}): ExportJobState =>
  input.read === null ? { export: input.previous.export, failures: input.previous.failures + 1 } : { export: input.read, failures: 0 };

/**
 * When to read it next: every 5 s while it is requested (OQ-36), backed off after failures, and **never once it has
 * settled** — a completed or failed export does not change again, so a poll past it is load with no reader (UX-116).
 */
export const nextExportPoll = (state: ExportJobState, random?: () => number): number | false =>
  state.export.status === EXPORT_STATUS.REQUESTED
    ? nextPollDelay({ interval: POLL_INTERVAL.EXPORT_JOB, failures: state.failures, random })
    : false;
