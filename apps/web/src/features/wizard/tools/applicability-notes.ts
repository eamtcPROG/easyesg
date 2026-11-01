import type { ApplicabilityCause, DisclosureField } from '@easyesg/contracts';
import { isAnswered } from '@easyesg/validation';
import { answerOf } from './answers-held';
import { STEP_ENTRY, type StepEntry } from './step-layout';

/**
 * What S-07 says about the fields a rule governs (task 95; UX-27, UX-28; `architecture.md` §12.5.6's task-95 row) —
 * pure, so which fields a note names, where it stands and when it returns are unit cases rather than journeys.
 *
 * **Every rule moves a field in another module than its B1 driver**, so nothing appears on the screen whose answer moved
 * it, and *appeared* has no reference on the wire. The note is therefore read off each step read: a field the reporter
 * is asked and a rule governs — its `applicabilityCause` is not null — carries one, naming the answer that brought it.
 */

/**
 * A cause's identity: two fields brought by one rule over one answer share a note — the condition, its drivers, its
 * threshold and the answer, the same four parts the api's `soleCause` compares.
 */
export const causeKey = (cause: ApplicabilityCause): string =>
  [
    cause.condition,
    cause.drivers.map((driver) => driver.elementKey).join(','),
    cause.threshold ?? '',
    cause.answer ?? '',
  ].join('\u0000');

/** UX-27's note: one cause, and every field on the step it brought. */
export interface ApplicabilityNote {
  readonly key: string;
  readonly cause: ApplicabilityCause;
  /** Each element once, in the step's order — a per-site question is one question however many sites ask it. */
  readonly elementKeys: readonly string[];
  /** What the note names them by, in the same order; an element the catalogue names nothing is left out. */
  readonly labels: readonly string[];
}

/** The notes for the fields a step asks, one per distinct cause, in the order their first field stands. */
export function applicabilityNotes(asked: readonly DisclosureField[]): ApplicabilityNote[] {
  const byCause = new Map<string, { cause: ApplicabilityCause; elements: Map<string, string | null> }>();
  for (const field of asked) {
    if (field.applicabilityCause === null) continue;
    const key = causeKey(field.applicabilityCause);
    const note = byCause.get(key) ?? { cause: field.applicabilityCause, elements: new Map<string, string | null>() };
    if (!note.elements.has(field.elementKey)) note.elements.set(field.elementKey, field.label);
    byCause.set(key, note);
  }
  return [...byCause.entries()].map(([key, note]) => ({
    key,
    cause: note.cause,
    elementKeys: [...note.elements.keys()],
    labels: [...note.elements.values()].filter((label): label is string => label !== null),
  }));
}

/**
 * **UX-28's subject: a field the reporter is no longer asked whose answer is kept.** Judged by the package's own
 * `isAnswered` (182/17), because since task 42.1 an unanswered field reads `state: ok` and a state alone cannot tell.
 */
export const isRetained = (field: DisclosureField): boolean => !field.applicable && isAnswered(answerOf(field));

/**
 * What the step lays out: the fields it asks, and in their own places the hidden ones whose answer is kept — drawn as a
 * notice, never as a control, so task 36.9's *not rendered* holds for the field.
 */
export const laidOutFields = (fields: readonly DisclosureField[]): DisclosureField[] =>
  fields.filter((field) => field.applicable || isRetained(field));

/** The elements an entry presents, whatever its shape. */
function entryElements(entry: StepEntry): readonly string[] {
  return entry.kind === STEP_ENTRY.FIELD
    ? [entry.field.elementKey]
    : entry.fields.map((field) => field.elementKey);
}

/**
 * Where each note stands: **before the first entry presenting one of its fields**, the Reporting Core artboard's
 * placement — the note over the questions it explains, not at the head of a step they may be far down.
 */
export function notesByEntry(input: {
  readonly entries: readonly StepEntry[];
  readonly notes: readonly ApplicabilityNote[];
}): ReadonlyMap<number, readonly ApplicabilityNote[]> {
  const placed = new Map<number, ApplicabilityNote[]>();
  for (const note of input.notes) {
    const index = input.entries.findIndex((entry) =>
      entryElements(entry).some((elementKey) => note.elementKeys.includes(elementKey)),
    );
    if (index === -1) continue;
    placed.set(index, [...(placed.get(index) ?? []), note]);
  }
  return placed;
}

/** The notes still to show: one stays while any field it names has not been dismissed. */
export const undismissed = (input: {
  readonly notes: readonly ApplicabilityNote[];
  readonly dismissed: ReadonlySet<string>;
}): ApplicabilityNote[] =>
  input.notes.filter((note) => note.elementKeys.some((elementKey) => !input.dismissed.has(elementKey)));

/**
 * **A dismissal ends when its field is seen not asked**, so a note returns with a field that left and came back — the
 * change UX-27 wants announced. The same set where nothing is forgotten, so a caller can skip a write.
 */
export function forgetNotAsked(input: {
  readonly dismissed: ReadonlySet<string>;
  readonly fields: readonly DisclosureField[];
}): ReadonlySet<string> {
  const notAsked = new Set(input.fields.filter((field) => !field.applicable).map((field) => field.elementKey));
  if (![...input.dismissed].some((elementKey) => notAsked.has(elementKey))) return input.dismissed;
  return new Set([...input.dismissed].filter((elementKey) => !notAsked.has(elementKey)));
}
