import { requestContext } from './request-context';

/**
 * A read-only request that composes several reads reads each shared thing once (task 244; `architecture.md` §12.5.6's
 * task-244 row (6)).
 *
 * S-07's step is one request since task 244, and the reads it composes — the step, the module list, the report, the
 * last run, the rules — each read the report and its stored answers for themselves, in one transaction that no write
 * can move. Rather than thread a pre-read through five services and the use cases beneath them, the route opens this scope
 * and the two repositories answer the second asking from the first.
 *
 * **Opt-in by a read-only route, and nothing else.** Outside the scope `sharedRead` reads every time, so a request that
 * writes — and then reads what it wrote, as the derivation recompute does — can never be answered from before its
 * write. The scope is the request's own context, so nothing outlives the request.
 */
export async function withSharedReads<T>(read: () => Promise<T>): Promise<T> {
  const ctx = requestContext();
  if (ctx === undefined || ctx.sharedReads !== undefined) return read();
  ctx.sharedReads = new Map();
  try {
    return await read();
  } finally {
    ctx.sharedReads = undefined;
  }
}

/** `read()` — or, inside `withSharedReads`, what the same key already read in this request. */
export function sharedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const shared = requestContext()?.sharedReads;
  if (shared === undefined) return read();
  const held = shared.get(key) as Promise<T> | undefined;
  if (held !== undefined) return held;
  const reading = read();
  shared.set(key, reading);
  return reading;
}
