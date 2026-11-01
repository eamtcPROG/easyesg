import type { DisclosureKind } from '@easyesg/vsme';

/**
 * What S-12 reads a history of (task 84; §12.5.6's task-84 row (1)): the bound organization, one reporting entity, or one
 * disclosure field of one report. **A discriminated union rather than a table name and an id**, because each subject
 * resolves its record differently — the organization is the session's, an entity is addressed, a field is found by its
 * natural key — and a caller naming a table is a caller able to name one the registry does not word.
 */
export const HISTORY_SUBJECT = {
  ORGANIZATION: 'organization',
  ENTITY: 'entity',
  VALUE: 'value',
} as const;

export type HistorySubjectKind = (typeof HISTORY_SUBJECT)[keyof typeof HISTORY_SUBJECT];

/** One disclosure field of a report, by the natural key §7.3 gives a value. */
export interface ValueField {
  readonly reportId: string;
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}

export type HistorySubject =
  | { readonly kind: typeof HISTORY_SUBJECT.ORGANIZATION }
  | { readonly kind: typeof HISTORY_SUBJECT.ENTITY; readonly entityId: string }
  | ({ readonly kind: typeof HISTORY_SUBJECT.VALUE } & ValueField);

/**
 * Where a disclosure value came from as a change left it (§12.5.6's task-84 row (4)) — the row's `carried_forward` and
 * `origin` read together: a carried value is carried whatever its origin says, and every other is its origin.
 */
export const CHANGE_SOURCE = {
  TYPED: 'typed',
  CARRIED_FORWARD: 'carried_forward',
  CALCULATED: 'calculated',
  OVERRIDDEN: 'overridden',
} as const;

export type ChangeSource = (typeof CHANGE_SOURCE)[keyof typeof CHANGE_SOURCE];

/**
 * One row of `core.field_change` as the history reads it, with the person its actor names.
 *
 * `statement` is the transaction's instant to the microsecond, as text: every row one statement wrote shares it, which
 * is what groups them into one entry — a `Date` keeps milliseconds only, and two statements a microsecond apart are two.
 */
export interface TrailRow {
  readonly id: string;
  readonly statement: string;
  readonly occurredAt: Date;
  readonly recordId: string;
  readonly fieldName: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  /** `null` where no person made the change — the platform's (row (4)). */
  readonly actor: ChangeActor | null;
}

/**
 * Who made a change, as an entry states it (row (c)): UX-137's name, `null` once the account is erased (FR-55 — the row
 * keeps the id and loses the name), and `removed` where they no longer hold an active membership of the organization.
 */
export interface ChangeActor {
  readonly accountId: string;
  readonly name: string | null;
  readonly removed: boolean;
}

/**
 * A field's value before it is worded — what the registry reads out of a record's image (§12.5.6's task-84 row (3)).
 *
 * **Compared raw and worded once**: two values are the same change or not by these members, so a statement that wrote
 * a column without moving what a reader sees is no entry, and the count the step read serves needs no words at all.
 */
export type RawValue =
  | { readonly kind: typeof RAW_VALUE.TEXT; readonly text: string }
  | { readonly kind: typeof RAW_VALUE.TERM; readonly vocabulary: Vocabulary; readonly term: string }
  | { readonly kind: typeof RAW_VALUE.ACTIVITIES; readonly codes: readonly string[] }
  | { readonly kind: typeof RAW_VALUE.ANSWER; readonly answer: RawAnswer };

export const RAW_VALUE = {
  TEXT: 'text',
  TERM: 'term',
  ACTIVITIES: 'activities',
  ANSWER: 'answer',
} as const;

/** The closed vocabularies a history words from the shared catalogue's `vocabulary` namespace (row (e)). */
export const VOCABULARY = {
  LEGAL_FORMS: 'legalForms',
  COUNTRIES: 'countries',
  CONSOLIDATION_BASES: 'consolidationBases',
  ENTITY_STATUSES: 'entityStatuses',
} as const;

export type Vocabulary = (typeof VOCABULARY)[keyof typeof VOCABULARY];

/**
 * A disclosure answer — the columns that together are what a reader sees in the field — read off the row's image as
 * text, because the trail holds text. A declared zero and a declared gap are states; every other answer is its columns.
 */
export interface RawAnswer {
  readonly state: string | null;
  readonly numeric: string | null;
  readonly text: string | null;
  readonly boolean: string | null;
  readonly date: string | null;
  readonly unit: string | null;
}

/**
 * A boolean column as the trail holds it — `jsonb`'s own spelling, read back as text by `->>`. Read by the source and
 * by a yes-or-no answer alike.
 */
export const STORED_BOOLEAN = { TRUE: 'true', FALSE: 'false' } as const;

/** One field a statement moved, before it is worded. `field` is the registry's key for it. */
export interface RawChange {
  readonly field: string;
  readonly from: RawValue | null;
  readonly to: RawValue | null;
}

/** One statement's changes, before they are worded — what `entriesOf` answers, newest first. */
export interface RawEntry {
  readonly at: Date;
  readonly actor: ChangeActor | null;
  readonly source: ChangeSource | null;
  readonly changes: readonly RawChange[];
}

/** One field a statement moved, worded — `field` null where it is the subject itself (a disclosure field's answer). */
export interface WordedChange {
  readonly field: string | null;
  readonly from: string | null;
  readonly to: string | null;
}

export interface ChangeEntry {
  readonly at: Date;
  readonly actor: ChangeActor | null;
  readonly source: ChangeSource | null;
  readonly changes: readonly WordedChange[];
}

/** A page of a subject's history, newest first, and how many entries it holds in all. */
export interface HistoryPage {
  readonly entries: readonly ChangeEntry[];
  readonly total: number;
}

/**
 * What a disclosure answer is worded against beyond its own columns — the element's kind, the report's pinned taxonomy
 * version for a choice's member labels, and the filing's currency for money. `null` for the two record subjects.
 */
export interface AnswerContext {
  readonly kind: DisclosureKind | null;
  readonly taxonomyVersion: string;
  readonly currency: string | null;
}
