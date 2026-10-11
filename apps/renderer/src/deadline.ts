/** A render that outlived its deadline — the hang T-13 names, which the caller answers by retrying elsewhere. */
export class DeadlineExceededError extends Error {
  constructor(readonly ms: number) {
    super(`The render ran past its ${ms} ms deadline and was killed.`);
  }
}

/**
 * Runs `work` and, if it has not settled within `ms`, calls `expire` — which kills what the work was waiting on — and
 * refuses with `DeadlineExceededError` once the kill is done.
 *
 * **Past the deadline the answer is the deadline's, whatever the work says.** Killing the browser is itself what makes
 * the work fail — a launch waiting on a browser that dies rejects — and that rejection arrives before the kill has
 * finished. Answered as it stands it would read as a broken render rather than a hung one, and leave the browser's
 * processes still dying behind the answer. So a failure after the deadline waits for the kill and becomes the deadline.
 */
export async function withDeadline<T>(input: {
  readonly ms: number;
  readonly work: () => Promise<T>;
  readonly expire: () => Promise<void>;
}): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  let killed: Promise<void> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      killed = input.expire().catch(() => undefined);
      void killed.then(() => reject(new DeadlineExceededError(input.ms)));
    }, input.ms);
  });
  const running = input.work();
  // A rejection after the deadline is the kill's doing, and is answered below — never left unhandled.
  running.catch(() => undefined);
  try {
    return await Promise.race([running, expired]);
  } catch (error) {
    if (killed === undefined) throw error;
    await killed;
    throw new DeadlineExceededError(input.ms);
  } finally {
    clearTimeout(timer);
  }
}
