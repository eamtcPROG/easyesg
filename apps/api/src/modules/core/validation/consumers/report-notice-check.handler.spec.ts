import type { CheckReportNotices } from '../use-cases/check-report-notices.use-case';
import { ReportNoticeCheckHandler } from './report-notice-check.handler';

/** The adapter over `CheckReportNotices` (task 51.2). */
describe('ReportNoticeCheckHandler (task 51.2)', () => {
  const payload = { periodId: 'period-1', asOf: 1_791_604_800_000, organizationId: 'org-1', occurredAtMicros: 1 };

  const build = () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    return { handler: new ReportNoticeCheckHandler({ execute } as unknown as CheckReportNotices), execute };
  };

  it('hands on the organization, the period and the sweep’s moment', async () => {
    const { handler, execute } = build();
    await handler.handle(payload);
    expect(execute).toHaveBeenCalledWith({ organizationId: 'org-1', periodId: 'period-1', asOf: new Date(1_791_604_800_000) });
  });

  it.each([
    ['no organization', { ...payload, organizationId: null }],
    ['no period', { ...payload, periodId: undefined }],
    ['a moment as text', { ...payload, asOf: '2026-10-09' }],
  ])('refuses a payload with %s', async (_, malformed) => {
    const { handler, execute } = build();
    await expect(handler.handle(malformed)).rejects.toThrow('validation.report_notice_check payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
