/**
 * Which steps the strip shows at `medium` — the *S-07/S-08 narrow* frame's *B1 … B6 · +5* (task 179.1).
 *
 * **The current step is always inside the window**, since the frame's caption says the current module is always named
 * on screen. The window starts at the first step while the current one fits, and otherwise slides so the current step
 * has one step after it — the next step is the likelier press than the one before. Everything outside the window is
 * behind the *+n*, which opens the whole list.
 *
 * Pure and its own module so the rule is a unit spec rather than a browser journey.
 */
export interface StripWindow {
  /** Index of the first step shown. */
  readonly start: number;
  /** One past the last step shown. */
  readonly end: number;
  /** How many steps the *+n* stands for. */
  readonly hidden: number;
}

export function stripWindow(input: {
  readonly count: number;
  /** Index of the current step; outside `0 … count - 1` is treated as none. */
  readonly current: number;
  readonly size: number;
}): StripWindow {
  const { count, current, size } = input;
  if (count <= size) return { start: 0, end: count, hidden: 0 };

  const last = count - size;
  const wanted = current >= 0 && current < count ? current - (size - 2) : 0;
  const start = Math.min(Math.max(wanted, 0), last);
  return { start, end: start + size, hidden: count - size };
}
