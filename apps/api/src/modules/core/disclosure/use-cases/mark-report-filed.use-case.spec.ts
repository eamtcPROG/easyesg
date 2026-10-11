import { ReportFilingDateInvalidError, ReportNotExportedError, ReportNotFoundError } from '../errors/report.errors';
import { REPORT_STATUS, statusAsRead } from '../models/report.model';
import { aReport, aReportSubject } from '../testing/report.fakes';
import { FakeReportFiling } from '../testing/report-filing.fakes';
import { MarkReportFiled } from './mark-report-filed.use-case';

const EXPORTED = '00000000-0000-0000-0000-0000000000f1';
const NEVER_EXPORTED = '00000000-0000-0000-0000-0000000000f2';

/** FR-41's filed mark (task 47.5; §12.5.6's task-47 row (1), (4)): after an export, on the day stated, locked or not. */
describe('MarkReportFiled', () => {
  const setup = () => {
    const subject = aReportSubject({ periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' } });
    const store = new FakeReportFiling(
      new Map([
        [EXPORTED, aReport({ id: EXPORTED, subject, status: REPORT_STATUS.LOCKED })],
        [NEVER_EXPORTED, aReport({ id: NEVER_EXPORTED, subject })],
      ]),
      new Set([EXPORTED]),
    );
    return { store, mark: new MarkReportFiled(store, store) };
  };

  it('marks a report with a completed export filed on the day stated, in its period’s zone, locked or not', async () => {
    const { mark } = setup();
    const report = await mark.execute({ reportId: EXPORTED, filedOn: '2026-10-09' });
    expect(report.filing?.filedOn).toEqual({ date: '2026-10-09', timezone: 'Europe/Chisinau' });
    // The lock's status stays the lock's; the mark reads over it.
    expect(report.status).toBe(REPORT_STATUS.LOCKED);
    expect(statusAsRead({ ...report, filed: report.filing !== null })).toBe(REPORT_STATUS.FILED);
  });

  it('refuses a day that is not one, and writes nothing', async () => {
    const { mark, store } = setup();
    await expect(mark.execute({ reportId: EXPORTED, filedOn: '2026-02-30' })).rejects.toBeInstanceOf(ReportFilingDateInvalidError);
    expect(store.reports.get(EXPORTED)?.filing).toBeNull();
  });

  it('refuses a report no export of which has completed, and one there is none of', async () => {
    const { mark } = setup();
    await expect(mark.execute({ reportId: NEVER_EXPORTED, filedOn: '2026-10-09' })).rejects.toBeInstanceOf(ReportNotExportedError);
    await expect(mark.execute({ reportId: '00000000-0000-0000-0000-0000000000ff', filedOn: '2026-10-09' })).rejects.toBeInstanceOf(
      ReportNotFoundError,
    );
  });
});
