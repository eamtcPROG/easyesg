import type { components } from './generated/v1';

/**
 * Disclosure vocabularies (FR-24 … FR-32, FR-40; tasks 34.1, 89, 35.2) — the consumer-side
 * declarations of values `apps/api` derives from its own `DISCLOSURE_STATE` and `REPORT_STATUS`
 * objects, and `@easyesg/vsme` from `DISCLOSURE_KIND`.
 *
 * Three copies for `membership.ts`'s stated reason: the api **produces** this package and must never
 * import it, so each is a mirror changed together with its source by hand. What these add over the
 * generated unions is the **runtime** value — the wizard writes `state: 'ok'` on every blur and
 * branches on `kind` to choose a control, and neither may be a literal at the site.
 *
 * **`DISCLOSURE_KIND` is mirrored rather than imported from `@easyesg/vsme`** (task 35.2). That
 * package dual-builds to `dist/` for its Node consumers (architecture.md OQ-47) and carries the
 * generated 143-descriptor facade; a browser bundle needs ten strings, and this package is already
 * the one both front ends read vocabularies from.
 *
 * **Each mirror is held against the generated enum at compile time**, below — one notch tighter
 * than the other mirrors, whose drift surfaces at `openapi:check`. A value added to the api's copy
 * and not here fails `pnpm typecheck` in this package, naming the mirror.
 */

/**
 * What a stored value *is*, beyond its contents — FR-40's five validation states plus the three that
 * are answers rather than verdicts (FR-30, FR-31, FR-32). §6.4 gives each a mark, a label and a
 * colour role; `missing` is the only one that is not an answer.
 */
export const DISCLOSURE_STATE = {
  OK: 'ok',
  MISSING: 'missing',
  INCONSISTENCY: 'inconsistency',
  ERROR: 'error',
  INVALID_URL: 'invalid_url',
  NOT_AVAILABLE: 'not_available',
  NOT_MATERIAL: 'not_material',
  NIL_RETURN: 'nil_return',
} as const;

export type DisclosureState = (typeof DISCLOSURE_STATE)[keyof typeof DISCLOSURE_STATE];

/**
 * What a disclosure *is*, as a form branches on it. The unit-bearing XBRL types collapse to
 * `numeric`: a mass and a volume are the same control, a number with a unit.
 */
export const DISCLOSURE_KIND = {
  TEXT: 'text',
  TEXT_BLOCK: 'text_block',
  BOOLEAN: 'boolean',
  DATE: 'date',
  YEAR: 'year',
  MONETARY: 'monetary',
  NUMERIC: 'numeric',
  PERCENT: 'percent',
  ENUMERATION: 'enumeration',
  ENUMERATION_SET: 'enumeration_set',
} as const;

export type DisclosureKind = (typeof DISCLOSURE_KIND)[keyof typeof DISCLOSURE_KIND];

/**
 * Which of §7.3's four typed value columns a kind is stored in — the operation over the vocabulary,
 * beside it (root `CLAUDE.md`: *"an operation over a vocabulary lives with the vocabulary, not with
 * each caller"*). A **mirror of `@easyesg/vsme`'s `COLUMN_OF_KIND`**, kept by hand like the objects
 * above; total over the kind, so a kind added here fails to compile until its column is decided.
 * **No workspace sees both copies**, so no compile-time hold joins them — the row in
 * `architecture.md` §12.5.6 records the limit. `year` is text on purpose: a calendar year is never
 * arithmetic, and stored as a number it renders as "2 026".
 */
export const VALUE_COLUMN = {
  NUMERIC: 'numeric',
  TEXT: 'text',
  BOOLEAN: 'boolean',
  DATE: 'date',
} as const;

export type ValueColumn = (typeof VALUE_COLUMN)[keyof typeof VALUE_COLUMN];

export const COLUMN_OF_KIND: Readonly<Record<DisclosureKind, ValueColumn>> = {
  [DISCLOSURE_KIND.TEXT]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.TEXT_BLOCK]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.BOOLEAN]: VALUE_COLUMN.BOOLEAN,
  [DISCLOSURE_KIND.DATE]: VALUE_COLUMN.DATE,
  [DISCLOSURE_KIND.YEAR]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.MONETARY]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.NUMERIC]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.PERCENT]: VALUE_COLUMN.NUMERIC,
  [DISCLOSURE_KIND.ENUMERATION]: VALUE_COLUMN.TEXT,
  [DISCLOSURE_KIND.ENUMERATION_SET]: VALUE_COLUMN.TEXT,
};

/**
 * Where a report stands. `open` and `locked` follow the reporting period's lock, which is their
 * only writer (FR-22); the other two are written by tasks 41.3 and 47 and not yet reachable.
 */
export const REPORT_STATUS = {
  OPEN: 'open',
  LOCKED: 'locked',
  READY_TO_FILE: 'ready_to_file',
  FILED: 'filed',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

/**
 * The compile-time hold. `Same<A, B>` is `true` only when the two unions are identical in both
 * directions; assigning it to `true` fails to compile the moment either side gains or loses a
 * member, and the failing line names which mirror drifted.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type GeneratedState = components['schemas']['DisclosureFieldDto']['state'];
type GeneratedKind = components['schemas']['DisclosureFieldDto']['kind'];
type GeneratedReportStatus = components['schemas']['ReportResponseDto']['status'];

const disclosureStateMirrorsTheApi: Same<DisclosureState, GeneratedState> = true;
const disclosureKindMirrorsTheApi: Same<DisclosureKind, GeneratedKind> = true;
const reportStatusMirrorsTheApi: Same<ReportStatus, GeneratedReportStatus> = true;

// Read once so the holds are not "unused" to the compiler; they exist for their types alone.
void disclosureStateMirrorsTheApi;
void disclosureKindMirrorsTheApi;
void reportStatusMirrorsTheApi;
