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
