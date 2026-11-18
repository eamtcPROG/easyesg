import type { NotificationPort, RaiseNotificationCommand } from '@api/contracts/notification.port';
import { REPORT_MIGRATION_STATUS, type ReportMigrationStatus } from '@api/contracts/report-migration';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { COMPATIBILITY, type Compatibility } from '../domain/version-mapping';
import type { MigrationRunDirectory, RunToExecute } from '../interfaces/migration-run-directory.interface';
import type { ReportMigrationOutcome, ReportMigrations } from '../interfaces/report-migrations.interface';
import { ExecuteMigrationRun } from './execute-migration-run.use-case';

const ALPHA = '00000000-0000-0000-0000-0000000000a1';
const BETA = '00000000-0000-0000-0000-0000000000b2';

const runOf = (determination: Compatibility, reverted = false): RunToExecute => ({
  id: '00000000-0000-0000-0000-0000000000f1',
  from: '2026-02-01',
  to: '2026-05-01',
  toTemplateVersion: '1.3.0',
  determination,
  reportIds: ['r-1', 'r-2', 'r-3'],
  reverted,
});

/**
 * The worker's fake keeps one row per report like the table, and **rolls back a report's work when it throws**, as the
 * report's transaction does — which is what lets the spec say a failed report records `failed` and nothing else.
 */
function build(input: { readonly run: RunToExecute; readonly failing?: readonly string[] }) {
  const rows = new Map<string, ReportMigrationStatus>();
  const bound: string[] = [];
  const raised: RaiseNotificationCommand[] = [];
  const directory: MigrationRunDirectory = {
    run: () => Promise.resolve(input.run),
    organizationsOf: () =>
      Promise.resolve([
        { organizationId: ALPHA, reportIds: ['r-1', 'r-2'] },
        { organizationId: BETA, reportIds: ['r-3'] },
      ]),
  };
  const migrations: ReportMigrations = {
    migrate: ({ reportId }) => {
      if (input.failing?.includes(reportId)) return Promise.reject(new Error('lock wait timeout\nat stack'));
      const settled = rows.get(reportId);
      if (settled !== undefined && settled !== REPORT_MIGRATION_STATUS.FAILED) return Promise.resolve(settled);
      const status =
        input.run.determination === COMPATIBILITY.COMPATIBLE ? REPORT_MIGRATION_STATUS.MIGRATED : REPORT_MIGRATION_STATUS.AWAITING_REVIEW;
      rows.set(reportId, status);
      return Promise.resolve(status);
    },
    recordFailure: ({ reportId }) => {
      rows.set(reportId, REPORT_MIGRATION_STATUS.FAILED);
      return Promise.resolve();
    },
    outcomes: () =>
      Promise.resolve(
        [...rows.entries()]
          .filter(([reportId]) => (bound.at(-1) === ALPHA ? ['r-1', 'r-2'] : ['r-3']).includes(reportId))
          .map(([reportId, status]): ReportMigrationOutcome => ({ reportId, status, entityName: `Entitatea ${reportId}`, fiscalYear: 2026 })),
      ),
    restorable: () => Promise.resolve([]),
    restore: () => Promise.reject(new Error('not used')),
    editors: () => Promise.resolve(['editor', 'administrator']),
    administrators: () => Promise.resolve(['administrator']),
  };
  const tenantWork: TenantWork = {
    inOrganization: (scope, work) => {
      bound.push(scope.organizationId);
      return work();
    },
  };
  const notifications: NotificationPort = {
    raise: (command) => {
      raised.push(command);
      return Promise.resolve({ notificationId: 'n' });
    },
    cancel: () => Promise.resolve(),
  };
  return { useCase: new ExecuteMigrationRun(directory, migrations, tenantWork, notifications), rows, raised };
}

describe('ExecuteMigrationRun (task 67.24)', () => {
  it('moves each report in its organization’s transaction and tells each organization once, its editors for a compatible pair', async () => {
    const { useCase, rows, raised } = build({ run: runOf(COMPATIBILITY.COMPATIBLE) });

    await useCase.execute({ runId: 'run' });

    expect([...rows.values()]).toEqual(['migrated', 'migrated', 'migrated']);
    expect(raised.map((notice) => notice.organizationId)).toEqual([ALPHA, BETA]);
    expect(raised[0]).toMatchObject({
      recipientUserIds: ['editor', 'administrator'],
      subjectRef: 'migration-run/00000000-0000-0000-0000-0000000000f1',
      deepLink: '/reports',
      params: { cause: 'migrated', reach: 'several', version: '2026-05-01' },
    });
    expect(raised[1]).toMatchObject({
      deepLink: '/reports/r-3',
      params: { cause: 'migrated', reach: 'one', entityName: 'Entitatea r-3', fiscalYear: '2026' },
    });
  });

  it('holds a breaking pair’s reports for the Organization Administrator, the notice opening the decision (182/43)', async () => {
    const { useCase, raised } = build({ run: runOf(COMPATIBILITY.BREAKING) });

    await useCase.execute({ runId: 'run' });

    expect(raised[1]).toMatchObject({
      recipientUserIds: ['administrator'],
      deepLink: '/reports/r-3/migration',
      params: { cause: 'review', reach: 'one' },
    });
  });

  it('records a report that fails, goes on with the rest, and tells an organization only of what moved', async () => {
    const { useCase, rows, raised } = build({ run: runOf(COMPATIBILITY.COMPATIBLE), failing: ['r-3'] });

    await useCase.execute({ runId: 'run' });

    expect(Object.fromEntries(rows)).toEqual({ 'r-1': 'migrated', 'r-2': 'migrated', 'r-3': 'failed' });
    expect(raised.map((notice) => notice.organizationId)).toEqual([ALPHA]);
  });

  it('moves nothing for a reverted run', async () => {
    const { useCase, rows, raised } = build({ run: runOf(COMPATIBILITY.COMPATIBLE, true) });

    await useCase.execute({ runId: 'run' });

    expect(rows.size).toBe(0);
    expect(raised).toEqual([]);
  });
});
