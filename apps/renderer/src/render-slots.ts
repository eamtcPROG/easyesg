/**
 * How many renders one renderer runs at once, the rest waiting their turn in arrival order. Chromium's memory is the
 * renderer's whole budget (T-13), so a burst queues here rather than launching a browser per request and reaching the
 * container's hard limit together. A render's deadline starts when it takes a slot, never while it waits.
 */
export function renderSlots(count: number) {
  let free = count;
  const waiting: (() => void)[] = [];
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else free += 1;
  };
  return {
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (free > 0) free -= 1;
      else await new Promise<void>((resolve) => waiting.push(resolve));
      try {
        return await work();
      } finally {
        release();
      }
    },
  };
}
