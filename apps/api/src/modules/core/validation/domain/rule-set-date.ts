import { calendarDateIn } from '@api/contracts/types/time';

/**
 * The date a report's rules are read as at (task 41.1; FR-73 item 9, 182/44): **today while its period is open, and
 * the day the period was locked once it is** — so a rule published mid-year reaches drafts, and a locked report's
 * findings do not move under a later rule (NFR-87). A reopened period is open again and reads as at today.
 *
 * **Both are days in the period's own zone** (§12.5.6's task-41 row (b)), the zone task 32.4 reads *overdue* in: a
 * lock just before midnight in Chișinău is a lock on that day, whatever UTC says.
 *
 * Pure, with the clock passed in, so the boundary is a unit spec.
 */
export const ruleSetDate = (input: {
  readonly lockedAt: Date | null;
  readonly timezone: string;
  readonly now: Date;
}): string => calendarDateIn({ instant: input.lockedAt ?? input.now, timezone: input.timezone });
