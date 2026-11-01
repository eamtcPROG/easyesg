import type { DisclosureValueResponse } from '@easyesg/contracts';

/**
 * What the api has acknowledged of the step's driving fields — a follow-on's question (task 80.1; `architecture.md`
 * §12.5.6's task-80.1 row (2)) — as one key, which moves exactly when one of their stored answers does.
 *
 * **The step is read again when it moves**, because a follow-on's verdict is the api's and S-07 lays acknowledged writes
 * over the step it read rather than reading it again; an answer to any other field leaves the key alone, so no other
 * write reads the step twice. Sorted, so the same answers make the same key whatever order they arrived in.
 */
export function driverAnswersKey(input: {
  readonly committed: Readonly<Record<string, DisclosureValueResponse>>;
  /** The element keys of the fields `drivesApplicability` marks. */
  readonly drivers: ReadonlySet<string>;
}): string {
  if (input.drivers.size === 0) return '';
  return Object.entries(input.committed)
    .filter(([, value]) => input.drivers.has(value.elementKey))
    .map(([key, value]) => `${key}\u0000${value.valueBoolean ?? ''}\u0000${value.valueText ?? ''}\u0000${value.state}`)
    .sort()
    .join('\u0001');
}
