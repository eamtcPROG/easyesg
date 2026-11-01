import { readFactorSetPayload } from './factor-set-payload';

/**
 * Why a factor set may not be published, or `null` where it may (task 37.4; FR-71, UC-80; `architecture.md` §12.5.6's
 * task-37.3/37.4 row (1), 182/50).
 *
 * **The reader's own rules, asked at the other end.** `readFactorSetPayload` is what every run reads a set with, so a
 * payload it rejects is one no run can use — and before this rule it still published, leaving every run for the
 * window refused until someone reverted. Asking the same function here is what keeps the two from drifting: there is
 * no second schema to fall out of step with the first.
 *
 * **Stricter than the reader, on purpose** (owner, 6 Oct 2026). The reader drops a malformed source and keeps the
 * rest, so a run is refused for that source alone rather than for the whole set; at publication someone is present to
 * correct it, and a dropped source is one no reporter can calculate. So a set the reader would read with a source
 * dropped is refused too.
 *
 * Pure, so the rule is a unit spec; `ConfigurationPublisher` asks it before it writes anything.
 */
export function factorSetRefusal(payload: unknown): string | null {
  const reading = readFactorSetPayload(payload);
  if (!reading.readable) return reading.reason;
  if (reading.dropped.length > 0) return `it carries malformed source(s): ${reading.dropped.join(', ')}`;
  return null;
}
