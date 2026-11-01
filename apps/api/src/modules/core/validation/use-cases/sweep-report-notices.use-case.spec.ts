import type { NotificationCadences } from '@api/contracts/notification-cadence.port';
import type { NoticeChecks } from '../interfaces/notice-checks.interface';
import type { OpenPeriod } from '../interfaces/notice-directory.interface';
import { SweepReportNotices } from './sweep-report-notices.use-case';

const CHISINAU = 'Europe/Chisinau';
const AS_OF = new Date('2026-10-09T04:00:00Z');

const period = (periodId: string, overrides: Partial<OpenPeriod> = {}): OpenPeriod => ({
  organizationId: `org-of-${periodId}`,
  periodId,
  timezone: CHISINAU,
  dueDate: null,
  reportCreatedAt: null,
  ...overrides,
});

function build(periods: readonly OpenPeriod[]) {
  const schedule = jest.fn<ReturnType<NoticeChecks['schedule']>, Parameters<NoticeChecks['schedule']>>().mockResolvedValue(2);
  const cadences: NotificationCadences = { repeatIntervalDays: () => 7, leadTimesDays: () => [14, 7, 1] };
  const sweep = new SweepReportNotices({ openPeriods: () => Promise.resolve(periods) }, cadences, { schedule });
  return { sweep, schedule };
}

describe('SweepReportNotices (task 51.2)', () => {
  it('schedules a check for each period that owes one today, and for no other', async () => {
    const { sweep, schedule } = build([
      period('repeat-day', { reportCreatedAt: new Date('2026-10-02T09:00:00Z') }),
      period('lead-day', { dueDate: { date: '2026-10-23', timezone: CHISINAU } }),
      period('nothing-today', { reportCreatedAt: new Date('2026-10-04T09:00:00Z'), dueDate: { date: '2026-11-30', timezone: CHISINAU } }),
    ]);

    await expect(sweep.execute({ asOf: AS_OF, day: '2026-10-09' })).resolves.toBe(2);
    expect(schedule).toHaveBeenCalledWith({
      day: '2026-10-09',
      asOf: AS_OF,
      periods: [
        { organizationId: 'org-of-repeat-day', periodId: 'repeat-day' },
        { organizationId: 'org-of-lead-day', periodId: 'lead-day' },
      ],
    });
  });

  it('schedules nothing on a day nothing owes', async () => {
    const { sweep, schedule } = build([period('quiet', { reportCreatedAt: new Date('2026-10-04T09:00:00Z') })]);
    await expect(sweep.execute({ asOf: AS_OF, day: '2026-10-09' })).resolves.toBe(0);
    expect(schedule).not.toHaveBeenCalled();
  });
});
