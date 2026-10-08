import type { SweepReportNotices } from '../use-cases/sweep-report-notices.use-case';
import { ReportNoticeSweepHandler } from './report-notice-sweep.handler';

/** The adapter over `SweepReportNotices` (task 51.2): the slot's day and moment, validated rather than cast. */
describe('ReportNoticeSweepHandler (task 51.2)', () => {
  const context = { jobId: 'validation.report_notice_sweep/2026-10-09', jobName: 'validation.report_notice_sweep', attempt: 1 };
  const payload = { day: '2026-10-09', organizationId: null, occurredAtMicros: 1_791_604_800_000_123 };

  const build = () => {
    const execute = jest.fn().mockResolvedValue(0);
    return { handler: new ReportNoticeSweepHandler({ execute } as unknown as SweepReportNotices), execute };
  };

  it('hands on the day, and the moment the slot’s row was written rather than its own clock’s', async () => {
    const { handler, execute } = build();
    await handler.handle(payload, context);
    expect(execute).toHaveBeenCalledWith({ day: '2026-10-09', asOf: new Date(1_791_604_800_000) });
  });

  it.each([
    ['no day', { ...payload, day: undefined }],
    ['a day that is not a date', { ...payload, day: 'today' }],
  ])('refuses a payload with %s', async (_, malformed) => {
    const { handler, execute } = build();
    await expect(handler.handle(malformed, context)).rejects.toThrow('validation.report_notice_sweep payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
