import type { DisclosureModuleSummary, DisclosureValueResponse } from '@easyesg/contracts';

/**
 * When the report was last saved — the time in the bar's *All changes saved · 12:04* (task 179.1).
 *
 * **Always the api's clock, never the browser's.** On arrival it is the newest `lastAnsweredAt` across the modules,
 * read on the server; after that, each acknowledged flush brings the rows as committed, each with its own `updatedAt`.
 * A time taken from the browser at the moment of the acknowledgement would be a device's claim about a commit it did
 * not make — and NFR-56 is that *saved* follows the durable commit.
 *
 * `null` where nothing has been answered: the indicator then says *saved* without a time, which is true — there is
 * nothing unsaved — and invents no moment.
 */
export function initialSavedAt(modules: readonly DisclosureModuleSummary[]): number | null {
  return newest(modules.map((summary) => summary.lastAnsweredAt));
}

export function lastSavedAt(input: {
  /** `initialSavedAt`, from the read the page was rendered with. */
  readonly initial: number | null;
  /** What the api acknowledged since — autosave's `committed`. */
  readonly committed: Readonly<Record<string, DisclosureValueResponse>>;
}): number | null {
  return newest([input.initial, ...Object.values(input.committed).map((value) => value.updatedAt)]);
}

const newest = (instants: readonly (number | null)[]): number | null =>
  instants.reduce<number | null>((latest, at) => (at !== null && (latest === null || at > latest) ? at : latest), null);
