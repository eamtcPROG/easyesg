import type { LegalDate } from '@api/contracts/types/time';

/**
 * The report — FR-24 … FR-32, FR-66, FR-177 (task 31.3; UC-17, UC-18).
 *
 * Not TypeORM entities (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's
 * representation, converted at the DTO boundary (OQ-50).
 */

/**
 * D-A's report-level scope — the `report_scope_known` CHECK's vocabulary.
 *
 * **Comprehensive is additive over Basic, never a second report.** FR-177 makes C1–C9 authorable
 * through the same wizard as B1–B11, driven by this one value, and settable both at creation and on
 * a report already in progress. That is why it is a flag on the report rather than a second row or
 * a second table: the same disclosures, the same validation and the same two export formats, over a
 * larger element set.
 *
 * It is also the axis a plan is sold on (`problem_overview.md` §6.1 row 15), which is why task 54's
 * entitlement guard will read it. Ungated until then, recorded as a deferral on this task's row.
 */
export const REPORT_SCOPE = {
  /** VSME Basic Module, B1–B11. The default and the legal ceiling on counterparty requests (D-A). */
  BASIC: 'basic',
  /** Basic plus the Comprehensive Module, C1–C9, authored over it (FR-177). */
  BASIC_AND_COMPREHENSIVE: 'basic_and_comprehensive',
} as const;

export type ReportScope = (typeof REPORT_SCOPE)[keyof typeof REPORT_SCOPE];

/**
 * The scope a report is created with when the caller names none.
 *
 * **Beside the vocabulary rather than at the call site**, per CLAUDE.md's rule that an operation
 * over a closed set belongs with the set: a default *is* a statement about the vocabulary, and a
 * copy in the DTO and another in the use case is how the OpenAPI `default` and the actual behaviour
 * come to disagree.
 *
 * Basic, because D-A makes it the product boundary — VSME's Basic Module is the legal ceiling on
 * what a counterparty may request — and because Comprehensive is the paid tier, which is not a
 * thing to opt somebody into by omission.
 */
export const DEFAULT_REPORT_SCOPE: ReportScope = REPORT_SCOPE.BASIC;

/**
 * The letter a Comprehensive Module reference begins with — the standard's own naming, B for Basic and C for
 * Comprehensive. Unexported: `scopeAsks` is its one reader.
 */
const COMPREHENSIVE_LETTER = 'C';

/**
 * Does a report of this scope ask the module (task 41.2; D-A, FR-177)? **Basic asks B1–B11; Basic and Comprehensive
 * asks every module**, Comprehensive being additive over Basic, never instead of it. Beside the vocabulary, per the rule
 * that an operation over a closed set lives with it. `apps/web`'s `modulesInScope` draws the wizard's list by the same
 * letter; the api may not import it, so the rule is stated twice and pinned by a spec on each side.
 */
export const scopeAsks = (input: { readonly scope: ReportScope; readonly module: string }): boolean =>
  input.scope === REPORT_SCOPE.BASIC_AND_COMPREHENSIVE || !input.module.startsWith(COMPREHENSIVE_LETTER);

/**
 * The report lifecycle — the `report_status_known` CHECK's vocabulary.
 *
 * **Four states are declared and two are reachable**, which is stated rather than left to be
 * discovered (§12.5.6's task-31.3 row). `OPEN` and `LOCKED` are written **only by the period lock**:
 * FR-22 makes the lock a property of the reporting period, and this column is its shadow inside the
 * report, moved in the same transaction so the two cannot disagree. Nothing else may write them.
 *
 * `READY_TO_FILE` is read since task 41.3 and `FILED` since task 47.5, and **neither is ever stored** (`statusAsRead`):
 * the column keeps the lock's two states. Both were declared with the column because its `CHECK` is frozen history the
 * day it ships and both prototypes draw all four.
 */
export const REPORT_STATUS = {
  /** Authorable. The state a report is created in. */
  OPEN: 'open',
  /** The period is locked, so the report takes no writes from anyone (FR-22). */
  LOCKED: 'locked',
  /**
   * Nothing outstanding at the latest validation run (task 41.3; FR-41 item 6; 182/19). **Read, never stored**: the
   * column keeps the lock's two states, and an open report whose latest run left nothing outstanding reads this one
   * (`statusAsRead`), so no write — and no lock — has to say what becomes of it (§12.5.6's task-41 row (2)).
   */
  READY_TO_FILE: 'ready_to_file',
  /**
   * The reporter marked it filed (task 47.5; FR-41; 182/19) — **read from the mark, never stored here**: the mark is a
   * record of its own beside this column, which a lock or a reopening leaves alone (§12.5.6's task-47 row (1)), and it
   * reads over the lock's two states and over readiness.
   */
  FILED: 'filed',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

/**
 * What a report is *about* — the entity and the period it covers, carried on the row.
 *
 * **A projection, not a second copy of the truth** (task 32.2, `architecture.md` §12.5.6). S-06's
 * purpose is *"find the entity/period combination to work on"*, and a list answering
 * `reportingPeriodId` alone is a list of identifiers rather than a screen. It is resolved by join at
 * read time, so nothing can drift: there is no column here and no write path that could set one.
 *
 * The dates are `LegalDate`s for the reason every period boundary is (NFR-34) — a boundary rendered
 * from an instant lands in the wrong fiscal year for a reader in another zone.
 */
export interface ReportSubject {
  readonly reportingEntityId: string;
  /** The undertaking's name as it stands **now**, not as the period's FR-18 snapshot recorded it.
   *  This is a wayfinding label on an index, so the current name is what a reader is looking for;
   *  what the filing discloses comes from the snapshot and is task 36's. */
  readonly entityName: string;
  readonly fiscalYear: number;
  readonly periodStart: LegalDate;
  readonly periodEnd: LegalDate;
  readonly dueDate: LegalDate | null;
}

/**
 * The status a reader is shown (tasks 41.3, 47.5; 182/19): `filed` for a report its reporter marked filed, whether its
 * period is open or locked (§12.5.6's task-47 row (1)); otherwise `ready_to_file` for an open report its latest
 * validation run left ready, and the stored status otherwise — the lock's `locked` stays `locked`. **Only at the wire**:
 * every rule about a report (a reminder refused once it is no longer open, the lock) reads the stored status, which
 * neither readiness nor the mark moves.
 */
export const statusAsRead = (report: {
  readonly status: ReportStatus;
  readonly readyToFile: boolean;
  readonly filed: boolean;
}): ReportStatus => {
  if (report.filed) return REPORT_STATUS.FILED;
  return report.status === REPORT_STATUS.OPEN && report.readyToFile ? REPORT_STATUS.READY_TO_FILE : report.status;
};

/**
 * The reporter's record that a report has left the building (task 47.5; FR-41; §12.5.6's task-47 row (1)–(4)): the day
 * they say it was filed, and who recorded it when — the database's, from the request's own binding.
 */
export interface ReportFiling {
  /** The day the reporter says it was filed — a calendar date in the period's zone (NFR-34). */
  readonly filedOn: LegalDate;
  readonly filedAt: Date;
  /** Who marked it, by the name they are shown under (UX-137) — a `null` name where the account is gone. */
  readonly filedBy: { readonly accountId: string; readonly name: string | null };
}

/**
 * What a report's latest validation run came to, as a list shows it (task 42.2; FR-23, FR-25; §12.5.6's task-42 row
 * (f)): the modules it found complete of those it counted, and the fields it left outstanding. Read as the run left it
 * (182/26), never a percentage (182/18).
 */
export interface ReportValidationSummary {
  readonly modulesComplete: number;
  readonly modulesCounted: number;
  readonly outstanding: number;
}

export interface Report {
  readonly id: string;
  /** The period this report covers. At most one report per period, so this identifies it too. */
  readonly reportingPeriodId: string;
  readonly scope: ReportScope;
  readonly status: ReportStatus;
  /**
   * Whether its latest validation run left nothing outstanding (task 41.3) — read from the run, never stored. The wire
   * shows it through `statusAsRead`.
   */
  readonly readyToFile: boolean;
  /** What its latest validation run came to (task 42.2), or `null` where it was never checked. */
  readonly validation: ReportValidationSummary | null;
  /** The reporter's filed mark (task 47.5), or `null` where it was never marked or the mark was withdrawn. */
  readonly filing: ReportFiling | null;
  /**
   * DR-4's pin — FR-66's *explicit template and taxonomy version against every report*.
   *
   * **Copied from the period at creation and never resolved a second time** (§12.5.6's task-31.3
   * row): the registry is asked once, at period open, for the period's own start date. `esg_app`
   * holds no `UPDATE` privilege on either column, so nothing in the request tier can move one —
   * the guarantee is the database's, not this interface's.
   */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /**
   * The currency this filing's monetary disclosures are stated in — ISO 4217 alpha-3 (task 36.12).
   *
   * **On the report because EFRAG's template carries one per workbook**, not one per figure: four
   * Basic elements are monetary (B1's `Assets` and `Turnover`, B2's financial investment, B11's
   * fines) and a currency per value would be finer than the standard's own model, and would let one
   * filing mix currencies with nothing objecting.
   *
   * **Pinned like the two versions above and by the same mechanism**: `esg_app` holds no `UPDATE`
   * privilege on the column, so nothing in the request tier can move it. A filing whose currency
   * changed after values were stored would reinterpret every monetary figure already in it.
   */
  readonly reportingCurrency: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Resolved by join on every read. See `ReportSubject`. */
  readonly subject: ReportSubject;
}

/**
 * What creating a report establishes.
 *
 * **The pins are absent by construction**, as they are on `NewReportingPeriod` and for a sharper
 * reason here: a caller who could name a version could pin a filing to one of their choosing, which
 * is DR-4 inverted. They are read from the period.
 *
 * `status` is absent too — a report is created open, and the period lock is the only thing that
 * moves it.
 */
export interface NewReport {
  readonly reportingPeriodId: string;
  readonly scope: ReportScope;
}

/**
 * What a later edit may name. **`scope` and nothing else** — FR-177 requires the flag settable on a
 * report already in progress, and every other column is either the pin, the lock's shadow, or
 * identity.
 */
export interface ReportPatch {
  readonly scope?: ReportScope;
}
