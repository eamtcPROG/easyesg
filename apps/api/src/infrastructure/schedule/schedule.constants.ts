/**
 * How often `ScheduleTicker` looks at the wall clock (task 51.2). A minute: a daily slot opens within a minute of its
 * time, and a look that finds nothing new costs no query, since each replica remembers the days it has written.
 */
export const SCHEDULE_TICK_MS = 60_000;
