import { calendarDateIn, isIanaTimeZone } from '@api/contracts/types/time';
import type { DailySlot } from './runs-daily';

const WALL_CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/u;

/** Minutes past midnight a slot opens at, or `null` for anything but a 24-hour `HH:MM`. */
export function slotMinutes(at: string): number | null {
  const match = WALL_CLOCK.exec(at);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

/** Whether a slot can be run at all: a well-formed time in a zone the runtime knows. */
export const isDailySlot = (slot: DailySlot): boolean => slotMinutes(slot.at) !== null && isIanaTimeZone(slot.timezone);

/**
 * The day whose run has opened at `now`, as `YYYY-MM-DD` in the slot's zone, or `null` while today's has not (task 51.2).
 *
 * **Today's run, from its time until midnight**, so a worker started late on the day — after a deploy, after an outage
 * — still writes the day's row. **Never yesterday's**: a day on which no worker ran is missed rather than caught up the
 * next morning, which would run two days' work at once and send yesterday's notices as today's. NFR-93's heartbeat is
 * what is meant to notice a missed day (§12.5.6's task-51.2 row (1)).
 */
export function openSlot(input: { readonly slot: DailySlot; readonly now: Date }): string | null {
  const opens = slotMinutes(input.slot.at);
  if (opens === null) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: input.slot.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(input.now);
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);
  const minutes = part('hour') * 60 + part('minute');
  return minutes < opens ? null : calendarDateIn({ instant: input.now, timezone: input.slot.timezone });
}
