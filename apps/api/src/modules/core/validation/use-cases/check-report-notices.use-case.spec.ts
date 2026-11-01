import type { NotificationCadences } from '@api/contracts/notification-cadence.port';
import type { CancelNotificationCommand, NotificationPort, RaiseNotificationCommand } from '@api/contracts/notification.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { NoticePeriod, NoticePeriods } from '../interfaces/notice-periods.interface';
import type { RollUp } from '../models/roll-up.model';
import { CheckReportNotices } from './check-report-notices.use-case';
import type { RunValidation } from './run-validation.use-case';

const CHISINAU = 'Europe/Chisinau';
/** 07:00 in Chișinău on 9 October 2026 — the sweep's moment. */
const AS_OF = new Date('2026-10-09T04:00:00Z');
const ORG = 'org-1';

/** The period's report, created seven days before the moment: today is the outstanding notice's repeat day. */
const REPORT = { reportId: 'report-1', createdAt: new Date('2026-10-02T09:00:00Z'), taxonomyVersion: '2026-05-01' };
/** The same report created four days before the moment: no repeat day, so only a deadline can fall due. */
const NEWER_REPORT = { ...REPORT, createdAt: new Date('2026-10-05T09:00:00Z') };

const PERIOD: NoticePeriod = {
  periodId: 'period-1',
  entityId: 'entity-1',
  entityName: 'Brutăria Lina SRL',
  fiscalYear: 2026,
  timezone: CHISINAU,
  dueDate: null,
  locked: false,
  archived: false,
  report: REPORT,
};

const field = (elementKey: string) => ({ elementKey, dimensionKey: '', ordinal: 0 });
const IN_PROGRESS: RollUp = {
  report: { resolved: 6, reasoned: 0, outstanding: 2 },
  modules: [
    { module: 'B1', resolved: 6, reasoned: 0, outstanding: 1, outstandingFields: [field('Turnover')] },
    { module: 'B3', resolved: 0, reasoned: 0, outstanding: 1, outstandingFields: [field('TotalEnergyConsumption')] },
  ],
};
const READY: RollUp = { report: { resolved: 8, reasoned: 0, outstanding: 0 }, modules: [] };
const UNTOUCHED: RollUp = { report: { resolved: 0, reasoned: 0, outstanding: 9 }, modules: [] };

type Call =
  | { readonly kind: 'raise'; readonly transaction: number; readonly command: RaiseNotificationCommand }
  | { readonly kind: 'cancel'; readonly transaction: number; readonly command: CancelNotificationCommand };

function build(input: {
  readonly period?: NoticePeriod | null;
  readonly rollUp?: RollUp;
  readonly editors?: readonly string[];
  readonly repeatIntervalDays?: number | null;
}) {
  let transaction = 0;
  const calls: Call[] = [];
  const run = jest.fn().mockResolvedValue({ run: null, findings: [], rollUp: input.rollUp ?? IN_PROGRESS });
  const periods: NoticePeriods = {
    find: () => Promise.resolve(input.period === undefined ? PERIOD : input.period),
    editors: () => Promise.resolve(input.editors ?? ['oa-1', 'rc-1']),
  };
  const cadences: NotificationCadences = {
    repeatIntervalDays: () => (input.repeatIntervalDays === undefined ? 7 : input.repeatIntervalDays),
    leadTimesDays: () => [14, 7, 1],
  };
  const tenantWork: TenantWork = {
    inOrganization: async (scope, work) => {
      expect(scope).toEqual({ organizationId: ORG });
      transaction += 1;
      return work();
    },
  };
  const notifications: NotificationPort = {
    raise: (command) => {
      calls.push({ kind: 'raise', transaction, command });
      return Promise.resolve({ notificationId: `n-${calls.length}` });
    },
    cancel: (command) => {
      calls.push({ kind: 'cancel', transaction, command });
      return Promise.resolve();
    },
  };
  const useCase = new CheckReportNotices(periods, { run } as unknown as RunValidation, cadences, tenantWork, notifications);
  return { useCase, calls, run, execute: () => useCase.execute({ organizationId: ORG, periodId: 'period-1', asOf: AS_OF }) };
}

/** The notices raised, narrowed from the calls — a cancellation carries no content. */
const raised = (calls: readonly Call[]): RaiseNotificationCommand[] =>
  calls.flatMap((call) => (call.kind === 'raise' ? [call.command] : []));

const subjects = (calls: readonly Call[], kind: Call['kind']) =>
  calls.filter((call) => call.kind === kind).map((call) => call.command.subjectRef);

describe('CheckReportNotices (task 51.2)', () => {
  it('on a repeat day, withdraws the open outstanding notice and raises one naming the current list, in a later transaction', async () => {
    const { calls, run, execute } = build({});
    await execute();

    expect(run).toHaveBeenCalledWith({ reportId: 'report-1' });
    const cancel = calls.find((call) => call.kind === 'cancel');
    const raise = calls.find((call) => call.kind === 'raise');
    expect(cancel?.command).toEqual({
      categoryKey: 'reporting.outstanding_report',
      organizationId: ORG,
      subjectRef: 'report:report-1:outstanding',
    });
    expect(raise?.command).toEqual({
      categoryKey: 'reporting.outstanding_report',
      organizationId: ORG,
      recipientUserIds: ['oa-1', 'rc-1'],
      subjectRef: 'report:report-1:outstanding',
      deepLink: '/reports/report-1',
      params: {
        entityName: 'Brutăria Lina SRL',
        fiscalYear: '2026',
        count: 2,
        intervalDays: 7,
        fields: {
          fieldList: {
            taxonomyVersion: '2026-05-01',
            modules: [
              { module: 'B1', elementKeys: ['Turnover'] },
              { module: 'B3', elementKeys: ['TotalEnergyConsumption'] },
            ],
          },
        },
      },
    });
    // FR-167's boundary: a raise sharing the cancellation's transaction would lose to it.
    expect(raise?.transaction).toBeGreaterThan(cancel?.transaction ?? Infinity);
  });

  it('withdraws the outstanding notice and raises none once nothing is outstanding', async () => {
    const { calls, execute } = build({ rollUp: READY });
    await execute();
    expect(subjects(calls, 'raise')).toEqual([]);
    expect(subjects(calls, 'cancel')).toContain('report:report-1:outstanding');
  });

  it('raises the deadline notice on a lead day, with the date, the days remaining and how far the report has come', async () => {
    const { calls, execute } = build({
      period: { ...PERIOD, dueDate: { date: '2026-10-16', timezone: CHISINAU }, report: NEWER_REPORT },
    });
    await execute();

    expect(calls).toEqual([
      {
        kind: 'raise',
        transaction: 1,
        command: {
          categoryKey: 'reporting.report_deadline',
          organizationId: ORG,
          recipientUserIds: ['oa-1', 'rc-1'],
          subjectRef: 'period:period-1:deadline:7',
          deepLink: '/reports/report-1',
          params: {
            entityName: 'Brutăria Lina SRL',
            fiscalYear: '2026',
            dueDate: { calendarDate: '2026-10-16' },
            daysRemaining: 7,
            started: 'yes',
            outstanding: 2,
          },
        },
      },
    ]);
  });

  it('says a report nothing has been answered in has not been started', async () => {
    const { calls, execute } = build({
      rollUp: UNTOUCHED,
      period: { ...PERIOD, dueDate: { date: '2026-10-10', timezone: CHISINAU }, report: NEWER_REPORT },
    });
    await execute();
    expect(raised(calls).map((command) => ({ subjectRef: command.subjectRef, started: command.params?.started }))).toEqual([
      { subjectRef: 'period:period-1:deadline:1', started: 'no' },
    ]);
  });

  it('raises no deadline notice for a report ready to file, and withdraws every lead time’s (BR-NOT-4)', async () => {
    const { calls, execute } = build({
      rollUp: READY,
      period: { ...PERIOD, dueDate: { date: '2026-10-16', timezone: CHISINAU }, report: NEWER_REPORT },
    });
    await execute();
    expect(subjects(calls, 'raise')).toEqual([]);
    expect(subjects(calls, 'cancel')).toEqual([
      'period:period-1:deadline:14',
      'period:period-1:deadline:7',
      'period:period-1:deadline:1',
    ]);
  });

  it('counts down for a period with no report yet, as not started, linking to the period, and runs nothing', async () => {
    const { calls, run, execute } = build({ period: { ...PERIOD, dueDate: { date: '2026-10-23', timezone: CHISINAU }, report: null } });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(subjects(calls, 'cancel')).toEqual([]);
    expect(
      raised(calls).map((command) => ({
        subjectRef: command.subjectRef,
        deepLink: command.deepLink,
        started: command.params?.started,
        outstanding: command.params?.outstanding,
        daysRemaining: command.params?.daysRemaining,
      })),
    ).toEqual([
      {
        subjectRef: 'period:period-1:deadline:14',
        deepLink: '/entities/entity-1/periods/period-1',
        started: 'no',
        outstanding: 0,
        daysRemaining: 14,
      },
    ]);
  });

  it.each([
    ['a period locked since the sweep', { ...PERIOD, locked: true }],
    ['an archived entity’s period', { ...PERIOD, archived: true }],
    ['a period gone', null],
    ['a period that owes nothing today', { ...PERIOD, report: NEWER_REPORT }],
  ])('owes nothing for %s, and runs nothing', async (_, period) => {
    const { calls, run, execute } = build({ period });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('raises nothing to an organization with nobody holding edit access', async () => {
    const { calls, execute } = build({ editors: [] });
    await execute();
    expect(subjects(calls, 'raise')).toEqual([]);
  });

  it('leaves the outstanding notice alone where its interval cannot be read', async () => {
    const { calls, run, execute } = build({ repeatIntervalDays: null });
    await execute();
    expect(run).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
