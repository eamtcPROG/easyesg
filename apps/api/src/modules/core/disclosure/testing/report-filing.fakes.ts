import type { LegalDate } from '@api/contracts/types/time';
import type { ReportFilingStore } from '../interfaces/report-filing-store.interface';
import type { Report } from '../models/report.model';

/**
 * The filed mark over a map of reports (task 47.5), modelling what the real statement decides: **a mark lands only on a
 * report with a completed export**, and who and when are stamped, never supplied — here by the fake's own actor and
 * clock, as the database stamps them from the binding and `now()`.
 */
export class FakeReportFiling implements ReportFilingStore {
  constructor(
    readonly reports: Map<string, Report>,
    private readonly exported: ReadonlySet<string>,
    private readonly actor = { accountId: '00000000-0000-0000-0000-0000000000d1', name: 'Ana Rusu' },
    private readonly now = new Date('2026-10-12T09:00:00Z'),
  ) {}

  findReport(input: { readonly reportId: string }): Promise<Report | null> {
    return Promise.resolve(this.reports.get(input.reportId) ?? null);
  }

  mark(command: { readonly reportId: string; readonly filedOn: LegalDate }): Promise<boolean> {
    const report = this.reports.get(command.reportId);
    if (!report || !this.exported.has(command.reportId)) return Promise.resolve(false);
    this.reports.set(command.reportId, { ...report, filing: { filedOn: command.filedOn, filedAt: this.now, filedBy: this.actor } });
    return Promise.resolve(true);
  }

  withdraw(command: { readonly reportId: string }): Promise<boolean> {
    const report = this.reports.get(command.reportId);
    if (!report) return Promise.resolve(false);
    this.reports.set(command.reportId, { ...report, filing: null });
    return Promise.resolve(true);
  }
}
