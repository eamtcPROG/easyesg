import { DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import {
  HISTORY_SUBJECT,
  RAW_VALUE,
  VOCABULARY,
  type HistorySubjectKind,
  type RawAnswer,
  type RawValue,
  type Vocabulary,
} from '../models/change-history.model';

/** A record's columns as the trail has rebuilt them — every value text, because the trail holds text. */
export type RecordImage = Readonly<Record<string, string | null>>;

/**
 * One field a history can state (§12.5.6's task-84 row (3)): the columns it is read from, and how. **The registry is the
 * whole of what S-12 can say** — a column no field names, an id, a timestamp, the tenant, a flag, is never shown, so a
 * column added to an audited table later reaches the panel only by being registered here.
 */
export interface HistoryField {
  /** The key the entry names it by, and its name's leaf under `core.trace.fields.<subject>`. */
  readonly key: string;
  readonly columns: readonly string[];
  read(image: RecordImage): RawValue | null;
  /** The subject itself — a disclosure field's answer — worded with no field name, since the panel is named for it. */
  readonly subject?: true;
}

/** A subject's audited table, its fields, and whether its entries state a source (a disclosure value's alone). */
export interface HistorySubjectShape {
  readonly table: string;
  readonly fields: readonly HistoryField[];
  /** Columns read to rebuild the image though no field shows them — the source's (row (4)). */
  readonly sourceColumns: readonly string[];
}

/** Text as it was typed; an empty string is no value, as a cleared field is. */
const text = (key: string, column: string = key): HistoryField => ({
  key,
  columns: [column],
  read: (image) => {
    const value = image[column] ?? null;
    return value === null || value.trim() === '' ? null : { kind: RAW_VALUE.TEXT, text: value };
  },
});

/** One member of a closed vocabulary, worded from the shared catalogue (row (e)). */
const term = (key: string, column: string, vocabulary: Vocabulary): HistoryField => ({
  key,
  columns: [column],
  read: (image) => {
    const value = image[column] ?? null;
    return value === null || value === '' ? null : { kind: RAW_VALUE.TERM, vocabulary, term: value };
  },
});

/** A list of activity codes — a `text[]` column, which the trail holds as its JSON. */
const activities = (key: string, column: string): HistoryField => ({
  key,
  columns: [column],
  read: (image) => {
    const codes = codesOf(image[column] ?? null);
    return codes.length === 0 ? null : { kind: RAW_VALUE.ACTIVITIES, codes };
  },
});

function codesOf(stored: string | null): readonly string[] {
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === 'string') : [];
}

/**
 * What a disclosure field holds, read as one value: its typed columns, its unit and its state together, because a unit
 * moved under the same figure is a change of what the field says, and a declared zero or gap is an answer of its own.
 */
const ANSWER_COLUMNS = ['state', 'value_numeric', 'value_text', 'value_boolean', 'value_date', 'unit_code'] as const;

const DECLARED: ReadonlySet<string> = new Set([DISCLOSURE_STATE.NIL_RETURN, DISCLOSURE_STATE.NOT_AVAILABLE]);

const answer: HistoryField = {
  key: 'answer',
  columns: ANSWER_COLUMNS,
  subject: true,
  read: (image) => {
    const raw: RawAnswer = {
      state: image.state ?? null,
      numeric: image.value_numeric ?? null,
      text: image.value_text === undefined || image.value_text === null || image.value_text.trim() === '' ? null : image.value_text,
      boolean: image.value_boolean ?? null,
      date: image.value_date ?? null,
      unit: image.unit_code ?? null,
    };
    const declared = raw.state !== null && DECLARED.has(raw.state);
    // A row holding nothing is no answer (182/17): a cleared field reads as the dash a field never answered does.
    if (!declared && raw.numeric === null && raw.text === null && raw.boolean === null && raw.date === null) return null;
    return { kind: RAW_VALUE.ANSWER, answer: raw };
  },
};

/** The audited table each subject reads and the fields it states (row (1), (3)). */
export const HISTORY_SUBJECTS: Readonly<Record<HistorySubjectKind, HistorySubjectShape>> = {
  [HISTORY_SUBJECT.ORGANIZATION]: {
    table: 'core.organization',
    fields: [
      text('name'),
      term('country', 'country_code', VOCABULARY.COUNTRIES),
      text('contactEmail', 'contact_email'),
      text('contactPhone', 'contact_phone'),
    ],
    sourceColumns: [],
  },
  [HISTORY_SUBJECT.ENTITY]: {
    table: 'core.reporting_entity',
    fields: [
      text('name'),
      term('legalForm', 'legal_form', VOCABULARY.LEGAL_FORMS),
      activities('activities', 'nace_codes'),
      text('idno'),
      text('lei'),
      text('addressLine1', 'registered_address_line1'),
      text('addressLine2', 'registered_address_line2'),
      text('locality', 'registered_locality'),
      text('postalCode', 'registered_postal_code'),
      text('contactName', 'report_contact_name'),
      text('contactEmail', 'report_contact_email'),
      term('consolidationBasis', 'consolidation_basis', VOCABULARY.CONSOLIDATION_BASES),
      term('standing', 'status', VOCABULARY.ENTITY_STATUSES),
    ],
    sourceColumns: [],
  },
  [HISTORY_SUBJECT.VALUE]: {
    table: 'core.report_disclosure_value',
    fields: [answer, text('notAvailableReason', 'not_available_reason'), text('explanation')],
    sourceColumns: ['origin', 'carried_forward'],
  },
};

/** Every column a subject's trail is read for — its fields' and its source's. */
export const columnsOf = (shape: HistorySubjectShape): readonly string[] => [
  ...new Set([...shape.fields.flatMap((field) => field.columns), ...shape.sourceColumns]),
];
