import { ReportNotFoundError } from '../errors/report.errors';
import { REPORT_STATUS, statusAsRead } from '../models/report.model';
import { aReport } from '../testing/report.fakes';
import { FakeReportFiling } from '../testing/report-filing.fakes';
import { MarkReportFiled } from './mark-report-filed.use-case';
import { WithdrawReportFiling } from './withdraw-report-filing.use-case';

const REPORT = '00000000-0000-0000-0000-0000000000f1';

/** Withdrawing FR-41's filed mark (task 47.5; §12.5.6's task-47 row (3)): no reason, and the lock's status untouched. */
describe('WithdrawReportFiling', () => {
  it('clears the mark, who and when with it, and leaves the lock’s status as it was', async () => {
    const store = new FakeReportFiling(new Map([[REPORT, aReport({ id: REPORT, status: REPORT_STATUS.LOCKED })]]), new Set([REPORT]));
    await new MarkReportFiled(store, store).execute({ reportId: REPORT, filedOn: '2026-10-09' });
    const report = await new WithdrawReportFiling(store, store).execute({ reportId: REPORT });
    expect(report.filing).toBeNull();
    expect(statusAsRead({ ...report, filed: false })).toBe(REPORT_STATUS.LOCKED);
  });

  it('answers an unmarked report as it stands, and refuses one there is none of', async () => {
    const store = new FakeReportFiling(new Map([[REPORT, aReport({ id: REPORT })]]), new Set());
    expect((await new WithdrawReportFiling(store, store).execute({ reportId: REPORT })).filing).toBeNull();
    await expect(new WithdrawReportFiling(store, store).execute({ reportId: '00000000-0000-0000-0000-0000000000ff' })).rejects.toBeInstanceOf(
      ReportNotFoundError,
    );
  });
});
