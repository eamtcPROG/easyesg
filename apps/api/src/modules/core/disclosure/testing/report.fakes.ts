import type { ReportStore } from '../interfaces/report-store.interface';
import type { EntitySnapshot } from '../models/entity-snapshot.model';
import {
  REPORT_SCOPE,
  REPORT_STATUS,
  type NewReport,
  type Report,
  type ReportPatch,
} from '../models/report.model';

/**
 * In-memory doubles for the use-case spec — no database, no container (the check
 * `apps/api/CLAUDE.md` names for whether a use case is framework-free).
 *
 * **The store fake models one organization, because RLS does**: the real store takes no organization
 * id anywhere. Cross-tenant behaviour is asserted where it is enforced, in the e2e suite.
 */

/** The adoption task 33.1's `reporting-taxonomy.vsme.json` registers. */
const REGISTERED_VERSION = '2026-05-01';

/** The joined subject (task 32.2). A fixture, because the fake stands in for a store whose reads
 *  resolve it — a fake answering `undefined` would model a shape the product cannot produce. */
const CHISINAU = 'Europe/Chisinau';

export const aReportSubject = (over: Partial<Report['subject']> = {}): Report['subject'] => ({
  reportingEntityId: '00000000-0000-0000-0000-0000000000b1',
  entityName: 'Brutăria Lina',
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: CHISINAU },
  periodEnd: { date: '2026-12-31', timezone: CHISINAU },
  dueDate: null,
  ...over,
});

export const aReport = (overrides: Partial<Report> = {}): Report => ({
  id: '00000000-0000-0000-0000-0000000000f1',
  reportingPeriodId: '00000000-0000-0000-0000-0000000000c1',
  scope: REPORT_SCOPE.BASIC,
  status: REPORT_STATUS.OPEN,
  templateVersion: REGISTERED_VERSION,
  taxonomyVersion: REGISTERED_VERSION,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  subject: aReportSubject(),
  ...overrides,
});

export class FakeReportStore implements ReportStore {
  /**
   * **The fake is constructed with the periods it may pin from**, because that is what the real
   * store's `INSERT ... SELECT` does — a report cannot exist without a period, and it takes its two
   * version strings from that period's row rather than from anything the caller supplies. A fake
   * that accepted a pin as an argument would model the shape DR-4 forbids and let a spec assert a
   * guarantee the product does not have.
   */
  constructor(
    private readonly periods: {
      id: string;
      templateVersion: string;
      taxonomyVersion: string;
      subject?: Report['subject'];
      /** What the period snapshotted at open; absent models a period that took none (pre-31.1). */
      snapshot?: EntitySnapshot;
    }[] = [],
    private rows: Report[] = [],
  ) {}

  get all(): readonly Report[] {
    return this.rows;
  }

  listReports(): Promise<Report[]> {
    return Promise.resolve(this.rows);
  }

  findReport(input: { reportId: string }): Promise<Report | null> {
    return Promise.resolve(this.rows.find((row) => row.id === input.reportId) ?? null);
  }

  entitySnapshotOf(input: { reportId: string }): Promise<EntitySnapshot | null> {
    // Through the report's period, as the real store's join does — never a snapshot keyed by report.
    const report = this.rows.find((row) => row.id === input.reportId);
    const period = this.periods.find((row) => row.id === report?.reportingPeriodId);
    return Promise.resolve(period?.snapshot ?? null);
  }

  create(input: { report: NewReport; at: Date }): Promise<Report | null> {
    const period = this.periods.find((row) => row.id === input.report.reportingPeriodId);
    // Null for an unknown period, matching the real store: its `INSERT ... SELECT` inserts nothing
    // when the period is missing or belongs to another tenant, and RLS makes those one answer.
    if (!period) return Promise.resolve(null);
    const created = aReport({
      id: `00000000-0000-0000-0000-0000000000f${this.rows.length + 1}`,
      reportingPeriodId: period.id,
      subject: period.subject ?? aReportSubject(),
      scope: input.report.scope,
      templateVersion: period.templateVersion,
      taxonomyVersion: period.taxonomyVersion,
      createdAt: input.at,
      updatedAt: input.at,
    });
    this.rows = [...this.rows, created];
    return Promise.resolve(created);
  }

  update(input: { reportId: string; patch: ReportPatch; at: Date }): Promise<Report | null> {
    const found = this.rows.find((row) => row.id === input.reportId);
    if (!found) return Promise.resolve(null);
    // The absent field is skipped rather than spread, exactly as the real store's `if (scope ===
    // undefined)` guard does — a plain spread of a DTO instance erases what the patch never named
    // (the defect task 31.1 hit, avoided here rather than rediscovered).
    const updated: Report = {
      ...found,
      scope: input.patch.scope ?? found.scope,
      updatedAt: input.at,
    };
    this.rows = this.rows.map((row) => (row.id === found.id ? updated : row));
    return Promise.resolve(updated);
  }
}
