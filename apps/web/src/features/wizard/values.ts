import {
  COLUMN_OF_KIND,
  DISCLOSURE_STATE,
  VALUE_COLUMN,
  type DisclosureField,
  type DisclosureValueResponse,
  type DisclosureValueWrite,
} from '@easyesg/contracts';

/**
 * From a control's draft to the write the store takes, and back (task 35.2).
 *
 * Which of the four typed columns a kind answers into is the taxonomy's business (§7.3), and the
 * browser reads that decision from `@easyesg/contracts`' `COLUMN_OF_KIND` rather than restating it.
 */
export { COLUMN_OF_KIND, VALUE_COLUMN } from '@easyesg/contracts';

/**
 * Reads a decimal the way a Moldovan reader types one, and answers the canonical string the wire
 * carries (NFR-58: a decimal as a string, never a float).
 *
 * Field-level UX with no business meaning, which is what may live in the form (root `CLAUDE.md`):
 * a space is the thousands separator §11 formats with, a comma is the decimal separator in `ro`
 * and `ru`, and either is accepted alongside the dot. What is refused is anything that is not a
 * number — two separators, letters, an empty sign — because the column is `numeric` and the
 * database would refuse it with a message no reader can act on.
 *
 * Empty is a legitimate answer here: it means *clear the field*, which the caller writes as a
 * `missing` state rather than as a value.
 */
export const parseDecimalInput = (raw: string): { readonly value: string | null } | { readonly invalid: true } => {
  const compact = raw.replace(/\s/gu, '');
  if (compact === '') return { value: null };
  const normalised = compact.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/u.test(normalised) ? { value: normalised } : { invalid: true };
};

/**
 * A boolean disclosure as a choice — the two option values the control offers. Radix reserves `''`
 * for "no choice", which is what an unanswered boolean is, so neither member may be empty.
 */
export const BOOLEAN_CHOICE = { YES: 'yes', NO: 'no' } as const;

export type BooleanChoice = (typeof BOOLEAN_CHOICE)[keyof typeof BOOLEAN_CHOICE];

/** The value a field **holds in the store**, in the column its kind answers into, as a draft. */
export function storedDraftOf(field: DisclosureField): string {
  return columnDraft(field.kind, field);
}

/**
 * What a control **shows**: the stored value, or the platform's default where nothing is stored
 * (task 36.2; FR-27, UX-109).
 *
 * The two are deliberately different functions rather than one with a flag. A control starts its
 * draft here and its *committed* at `storedDraftOf`, which is precisely what makes an untouched
 * default commit on blur: the draft differs from what was last sent (§12.5.6, task 91.2's row —
 * *"a default nobody edits becomes an answer when the client commits it"*). One function could not
 * express that difference, and a control seeding both from the same place would silently discard
 * every pre-filled value the reporter accepted.
 */
export function draftOf(field: DisclosureField): string {
  const stored = storedDraftOf(field);
  if (stored !== '' || field.defaultValue === null) return stored;
  return columnDraft(field.kind, field.defaultValue);
}

/** The one column-to-draft mapping both readings share. */
function columnDraft(
  kind: DisclosureField['kind'],
  value: Pick<DisclosureField, 'valueNumeric' | 'valueText' | 'valueBoolean' | 'valueDate'>,
): string {
  switch (COLUMN_OF_KIND[kind]) {
    case VALUE_COLUMN.NUMERIC:
      return value.valueNumeric ?? '';
    case VALUE_COLUMN.DATE:
      return value.valueDate ?? '';
    case VALUE_COLUMN.BOOLEAN:
      if (value.valueBoolean === null) return '';
      return value.valueBoolean ? BOOLEAN_CHOICE.YES : BOOLEAN_CHOICE.NO;
    default:
      return value.valueText ?? '';
  }
}

/**
 * The writes that turn a step's shown defaults into stored answers (task 36.2; FR-27, UX-34).
 *
 * **UX-34 says *"on blur or step change"*, and for a default that has to mean the step the reporter
 * arrives at, not the one they leave.** `useAutosave` states the reason in its own header — *"a step
 * change persists; it does not fire"* — and mirrors the queue to the durable store **in an effect**,
 * so a write enqueued from an unmount cleanup updates a reducer nobody will read and never reaches
 * the store. Arrival is the moment the machinery can carry, and it is a step change like any other.
 *
 * A field whose draft already equals what is stored contributes nothing, so this is empty on every
 * visit after the first — and empty for every field the platform cannot answer, which is most.
 */
export function outstandingDefaults(fields: readonly DisclosureField[]): readonly DisclosureValueWrite[] {
  return fields.flatMap((field) => {
    const shown = draftOf(field);
    return shown === '' || shown === storedDraftOf(field) ? [] : [writeFor(field, shown)];
  });
}

/**
 * How an `enumeration_set` answer is written: the chosen members, space-separated (task 91.1).
 *
 * The separator is the taxonomy's, not this screen's — `architecture.md` §12.5.6 states it for the
 * store and the export alike — so it is declared once here and never spelled at a call site.
 */
export const MEMBER_SEPARATOR = ' ';

/** The members a set-valued draft holds, in the order the reporter chose them. */
export const membersOf = (draft: string): readonly string[] =>
  draft.split(/\s+/u).filter((member) => member !== '');

/** Those members back as one draft. Empty is the empty string, which clears the field. */
export const draftOfMembers = (members: readonly string[]): string => members.join(MEMBER_SEPARATOR);

/**
 * Which unit this field is answered in — the reporter's choice, else what the row was written with,
 * else the one unit the standard admits (task 91.4; UX-14).
 *
 * **Where several are admitted there is NO default, and that is a decision rather than an omission**
 * (project owner, 8 Sep 2026, closing a question this function's first version answered by
 * accident). It read `?? field.unitCodes[0]`, on the belief that EFRAG's list order is a
 * preference — nothing in the package says so, and the Digital Template contradicts it outright: its
 * B4 cell ships **`metric tonnes (t)`** while the taxonomy lists `[utr:kg,utr:t]`. Combined with
 * task 91.2's rule that a shown default becomes an answer on commit, a reporter who typed a figure
 * and never opened the chooser would have filed **kilogrammes where the standard's own workbook
 * files tonnes** — a thousandfold error on a pollution disclosure, written silently.
 *
 * So `null` until chosen, and UX-14 is the better served for it: an *explicit* unit is what that
 * rule asks for, and a chosen one is more explicit than an assumed one. A figure entered before the
 * choice is stored with no unit — visible as a gap, which validation (task 40) is what expresses —
 * rather than stored under a unit nobody picked.
 *
 * **One admitted unit is not a choice and is applied**: UX-14's *fixed by the taxonomy* branch, 25
 * of the 38 elements that carry a unit list at all.
 *
 * `null` too where the standard states none — 40 of the 78 quantitative elements, which render no
 * unit rather than an invented one.
 */
export const unitOf = (
  field: Pick<DisclosureField, 'unitCode' | 'unitCodes'>,
  chosen: string | null,
): string | null =>
  chosen ?? field.unitCode ?? (field.unitCodes.length === 1 ? (field.unitCodes[0] ?? null) : null);

/**
 * The write for one field's new value, or its clearing.
 *
 * `null` clears: the row keeps its natural key and moves to `missing` with every column null, which
 * the store's own constraint admits. The carried-forward mark is dropped on any edit (UX-32: marked
 * as carried *until edited*), and a not-available reason cannot outlive its state (§7.3's check).
 */
export function writeFor(
  field: Pick<DisclosureField, 'elementKey' | 'dimensionKey' | 'ordinal' | 'kind' | 'unitCode'>,
  value: string | boolean | null,
): DisclosureValueWrite {
  const column = COLUMN_OF_KIND[field.kind];
  // The generated write type carries no `null`: an absent column is omitted, and the api's own
  // controller reads an omission as null. Only the answered column is set.
  const base: DisclosureValueWrite = {
    elementKey: field.elementKey,
    dimensionKey: field.dimensionKey,
    ordinal: field.ordinal,
    ...(field.unitCode === null ? {} : { unitCode: field.unitCode }),
    state: value === null ? DISCLOSURE_STATE.MISSING : DISCLOSURE_STATE.OK,
    carriedForward: false,
  };
  if (value === null) return base;
  switch (column) {
    case VALUE_COLUMN.NUMERIC:
      return { ...base, valueNumeric: String(value) };
    case VALUE_COLUMN.DATE:
      return { ...base, valueDate: String(value) };
    case VALUE_COLUMN.BOOLEAN:
      return { ...base, valueBoolean: typeof value === 'boolean' ? value : value === BOOLEAN_CHOICE.YES };
    default:
      return { ...base, valueText: String(value) };
  }
}

/**
 * FR-32's reasoned non-answer, and the return from it (UC-31, UX-15; task 36.5).
 *
 * **A pair of functions rather than a third argument to `writeFor`**, because they are not the same
 * act. `writeFor` carries a *value* into the column its kind answers into; these carry a **state**,
 * and the value columns go with it — a figure left behind under `not_available` would be exported
 * as a gap while the store still held a number (UX-119: a reader must never be unable to tell a
 * zero from a gap).
 *
 * **The reason is required exactly when the state is `not_available`**, which is the store's own
 * `CHECK` rather than this module's opinion — so resuming clears it in the same write, and a reason
 * cannot outlive the state it explains.
 */
export function notAvailableWrite(
  field: Pick<DisclosureField, 'elementKey' | 'dimensionKey' | 'ordinal'>,
  reason: string,
): DisclosureValueWrite {
  return {
    elementKey: field.elementKey,
    dimensionKey: field.dimensionKey,
    ordinal: field.ordinal,
    state: DISCLOSURE_STATE.NOT_AVAILABLE,
    notAvailableReason: reason,
    // A declared gap is the reporter's own decision, so it is no longer last year's answer.
    carriedForward: false,
  };
}

/**
 * Back to unanswered, from a declared gap.
 *
 * **`missing` rather than the value that was there before**, because there is none: declaring
 * cleared the columns, and inventing a previous value from the screen's memory would resurrect a
 * figure the reporter deliberately withdrew. Resuming means the field is open again, not that the
 * old answer returns.
 */
export function resumeWrite(
  field: Pick<DisclosureField, 'elementKey' | 'dimensionKey' | 'ordinal'>,
): DisclosureValueWrite {
  return {
    elementKey: field.elementKey,
    dimensionKey: field.dimensionKey,
    ordinal: field.ordinal,
    state: DISCLOSURE_STATE.MISSING,
    // **Omitted, not null.** The generated write type carries no `null` here — an absent member is
    // how this wire says *clear it*, which `writeFor` above records for the value columns; the
    // store's own `CHECK` then refuses a reason that outlived its state.
    carriedForward: false,
  };
}

/** A field as the screen shows it once the API has acknowledged a write for it. */
export function withCommitted(
  field: DisclosureField,
  value: DisclosureValueResponse | undefined,
): DisclosureField {
  return value === undefined
    ? field
    : {
        ...field,
        valueNumeric: value.valueNumeric,
        valueText: value.valueText,
        valueBoolean: value.valueBoolean,
        valueDate: value.valueDate,
        unitCode: value.unitCode,
        state: value.state,
        notAvailableReason: value.notAvailableReason,
        carriedForward: value.carriedForward,
      };
}
