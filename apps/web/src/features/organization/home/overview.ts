import { REPORT_STATUS, type ReportingPeriod } from '@easyesg/contracts';
import { todayIn } from '@/lib/legal-date';

/**
 * S-05's report status overview — UC-67 and FR-23 (task 32.4), completing the stub task 30.5 drew.
 *
 * **Pure, and carrying no `server-only`**, which is `reports.ts`'s split: the standing, the
 * attention rule and the ordering are rules over data somebody else fetched, so every branch is a
 * unit spec rather than a browser journey. Two of them — a deadline that has passed, and a locked
 * period nobody opened a report against — are states a journey would have to contrive.
 *
 * **The row is a period, not a report**, and that is FR-23 read literally: *"every entity **and
 * period** in the organization"*. Since task 31.3 a report is an explicit creation, so a period
 * with a deadline nobody has started is the row *"is everything ready before the deadline"* is
 * actually asked about — and it is invisible to `GET /reports` by construction.
 */

/**
 * Where a filing stands, as one value.
 *
 * **`REPORT_STATUS` plus the state that has no report**, declared once here rather than left as a
 * nullable status every reader re-branches on: the chip's tone, its label and the two rules below
 * all key off it, and a `?? 'notStarted'` at each of them is four places the fifth state could be
 * forgotten. The four report members are the contract's own values, never restated — a fifth
 * status added by task 41.3 or 47 reaches this file as a type error at `FILING_RULES`.
 */
export const OVERVIEW_STANDING = {
  /**
   * No report has been opened against the period.
   *
   * A real state since task 31.3 made a report an explicit creation — `architecture.md` §7.2's
   * amended `REPORTING_PERIOD ||--o| REPORT`, and §12.5.6's task-31.3 row. (Not FR-177, whose
   * subject is the Comprehensive Module and which reaches that row only for `scope`.)
   */
  NOT_STARTED: 'not_started',
  IN_PROGRESS: REPORT_STATUS.OPEN,
  LOCKED: REPORT_STATUS.LOCKED,
  READY_TO_FILE: REPORT_STATUS.READY_TO_FILE,
  FILED: REPORT_STATUS.FILED,
} as const;

export type OverviewStanding = (typeof OVERVIEW_STANDING)[keyof typeof OVERVIEW_STANDING];

/**
 * What each standing means for the two questions UX-6 asks above the fold, in one table.
 *
 * **Exhaustive by `Record`, and both facts stated for every member** — a `switch` with a default,
 * or a filter written as `!== FILED`, would give a status added later an answer nobody decided.
 * Two of the five cannot occur yet and are answered anyway, because the day they can is not the day
 * to be discovering what this screen thinks of them:
 *
 * - `attention` — somebody must still act. `locked` is **not** attention: FR-22 makes a locked
 *   period read-only for everyone, so there is nothing to do to it here and reopening is a
 *   deliberate administrative act rather than a to-do. `ready_to_file` **is**, because the act it
 *   waits on — filing — is real work that has not happened; its producer is task 41.3.
 * - `resumable` — *where did I leave off* may point here. A locked report is resumable and opens
 *   read-only, which is the state S-07 already draws (`READ_ONLY_CAUSE.LOCKED`). A filed one is
 *   finished, and resuming it is not the question UX-6 asks.
 */
const FILING_RULES: Record<
  OverviewStanding,
  { readonly attention: boolean; readonly resumable: boolean }
> = {
  [OVERVIEW_STANDING.NOT_STARTED]: { attention: true, resumable: false },
  [OVERVIEW_STANDING.IN_PROGRESS]: { attention: true, resumable: true },
  [OVERVIEW_STANDING.LOCKED]: { attention: false, resumable: true },
  [OVERVIEW_STANDING.READY_TO_FILE]: { attention: true, resumable: true },
  [OVERVIEW_STANDING.FILED]: { attention: false, resumable: false },
};

/** One entity's one year, as the overview reads it. */
export interface OverviewRow {
  readonly periodId: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  /**
   * ISO `YYYY-MM-DD`, never `Date` — NFR-34 held at the last boundary that could break it, which is
   * `reports.ts`'s rule verbatim: `new Date('2026-12-31')` is an instant, and rendered in a zone
   * behind UTC it is the 30th and the wrong fiscal year.
   */
  readonly periodStart: string;
  readonly periodEnd: string;
  /** FR-21's due date, which is what a deadline question is asked about. Null where none was set. */
  readonly due: string | null;
  readonly standing: OverviewStanding;
  /**
   * The deadline has passed and the filing is not settled.
   *
   * **A comparison, never a threshold.** *Due soon* would need a lead time, and FR-173 holds those
   * as notification-catalogue configuration that does not exist until task 50 — inventing one here
   * would read to a reporter as guidance from the standard.
   */
  readonly overdue: boolean;
  /** Whether somebody must still act on this filing. `FILING_RULES`, and the period's own lock. */
  readonly attention: boolean;
  /** FR-22. A locked period takes no writes from anyone, the administrator included. */
  readonly periodLocked: boolean;
  /** Null where no report has been opened, which is what makes the row's action a *create*. */
  readonly reportId: string | null;
  /** Epoch-ms (OQ-50). The report's last activity, and how *where did I leave off* is chosen. */
  readonly lastActivity: number | null;
}

const standingOf = (period: ReportingPeriod): OverviewStanding =>
  period.report === null ? OVERVIEW_STANDING.NOT_STARTED : period.report.status;

/**
 * The overview's rows, from the organization's periods.
 *
 * `now` is a parameter rather than a call to the clock inside, so *overdue* is a unit spec instead
 * of a test that has to wait for a date to arrive.
 */
export const toOverviewRows = (input: {
  readonly periods: readonly ReportingPeriod[];
  readonly now: Date;
}): OverviewRow[] =>
  input.periods.map((period) => {
    const standing = standingOf(period);
    const periodLocked = period.lockedAt !== null;
    // **A locked period is never attention, whatever its standing.** Without this a locked period
    // holding no report reads as *not started* and the screen offers a report the API refuses to
    // create — the control that cannot act, one level up from where task 30.1 ruled against it.
    const attention = FILING_RULES[standing].attention && !periodLocked;

    return {
      periodId: period.id,
      entityId: period.reportingEntityId,
      entityName: period.entityName,
      fiscalYear: period.fiscalYear,
      periodStart: period.periodStart.date,
      periodEnd: period.periodEnd.date,
      due: period.dueDate?.date ?? null,
      standing,
      // **Read in the period's own zone, not the reader's.** NFR-34 makes a due date a legal date,
      // and *has the deadline passed* is a legal question — a bookkeeper working from another
      // country must not see a different answer from the one the filing is judged by.
      overdue:
        attention &&
        period.dueDate !== null &&
        period.dueDate.date < todayIn(period.dueDate.timezone, input.now),
      attention,
      periodLocked,
      reportId: period.report?.id ?? null,
      lastActivity: period.report?.updatedAt ?? null,
    };
  });

/**
 * *What needs my attention* — UX-6's first question.
 *
 * **Soonest deadline first, and a period with no due date last.** FR-21 makes the due date optional
 * and it is what a deadline question is asked about, so a row that has none cannot be placed on
 * that scale at all; ordering it by its period end keeps it in a sensible place rather than
 * pretending it is urgent or that it does not exist.
 */
export const attentionRows = (rows: readonly OverviewRow[]): OverviewRow[] =>
  rows
    .filter((row) => row.attention)
    .sort((left, right) => {
      if (left.due !== right.due) {
        if (left.due === null) return 1;
        if (right.due === null) return -1;
        return left.due.localeCompare(right.due);
      }
      // ISO days compare as strings, which is why they are held as strings at all.
      return left.periodEnd.localeCompare(right.periodEnd) || left.entityName.localeCompare(right.entityName);
    });

/**
 * A row that can be resumed — **the narrowing carried in the type**, not left to the caller.
 *
 * `resumableRow`'s filter already guarantees a report id; without saying so, every caller writes a
 * `?? ''` or a non-null assertion into a link's href, which is a wrong address rather than an
 * error the day the filter changes.
 */
export type ResumableRow = OverviewRow & { readonly reportId: string };


/**
 * *Where did I leave off* — UX-6's second question, as at most one report.
 *
 * **The most recently touched, and the screen never picks a step.** Task 35.3's redirector resolves
 * where work last happened inside a report from the module summaries; this only decides *which*
 * report, so the two cannot disagree about the position.
 */
export const resumableRow = (rows: readonly OverviewRow[]): ResumableRow | null =>
  rows
    .filter((row): row is ResumableRow => row.reportId !== null && FILING_RULES[row.standing].resumable)
    .reduce<ResumableRow | null>(
      (latest, row) =>
        latest === null || (row.lastActivity ?? 0) > (latest.lastActivity ?? 0) ? row : latest,
      null,
    );

/**
 * *What is the state of everything* — UX-6's third question, and FR-23's own sentence.
 *
 * **By entity, then most recent year first.** The attention list is ordered by urgency and this one
 * is ordered for reading: an organization filing for three entities wants its three histories
 * legible, not interleaved by date. UX-6 requires one template to serve one entity and many, and
 * this order degenerates to *newest year first* when there is only one.
 */
export const everythingRows = (rows: readonly OverviewRow[]): OverviewRow[] =>
  [...rows].sort(
    (left, right) =>
      left.entityName.localeCompare(right.entityName) ||
      right.fiscalYear - left.fiscalYear ||
      // A stable tiebreak, so two rows that compare equal never swap between renders. The id is the
      // only field guaranteed distinct — an entity can hold two periods labelled the same year.
      left.periodId.localeCompare(right.periodId),
  );
