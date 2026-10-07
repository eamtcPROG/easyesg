import type {
  CancelNotificationCommand,
  NotificationPort,
  RaiseNotificationCommand,
} from '@api/contracts/notification.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { FactorSetUsers } from '../interfaces/factor-set-users.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { ReportUpdateAudience } from '../interfaces/report-update-audience.interface';
import type { FactorSetPin } from '../models/factor-set.model';
import type { AffectedReport } from '../models/report-update.model';
import { NotifyFactorSetReplaced } from './notify-factor-set-replaced.use-case';

/**
 * FR-166's factor half (task 37.3): one notice per organization with an open report calculated on the set leaving,
 * raised inside a unit bound to that organization — and the set entering withdrawing its own.
 *
 * The fakes share one variable, the organization the unit of work has bound, so the audience answers for the bound
 * organization alone and a read made outside a unit fails — which is what row-level security does to the real one.
 */

const ALPHA = '00000000-0000-0000-0000-0000000000a1';
const BETA = '00000000-0000-0000-0000-0000000000b1';
const ANA = '00000000-0000-0000-0000-0000000000d1';
const ION = '00000000-0000-0000-0000-0000000000d2';

const report = (reportId: string, entityName = 'Brutăria Lina SRL'): AffectedReport => ({
  reportId,
  entityName,
  fiscalYear: 2026,
});

interface World {
  /** Organizations with a run on each revision of `md`. */
  readonly usersOf: Record<number, readonly string[]>;
  readonly reportsOf?: Record<string, readonly AffectedReport[]>;
  readonly editorsOf?: Record<string, readonly string[]>;
  /** Readable labels by revision; a revision absent here is unreadable. */
  readonly labels?: Record<number, string>;
}

const build = (world: World) => {
  let bound: string | null = null;
  const raised: { command: RaiseNotificationCommand; bound: string | null }[] = [];
  const cancelled: { command: CancelNotificationCommand; bound: string | null }[] = [];
  const order: string[] = [];

  const boundOrganization = (): string => {
    if (bound === null) throw new Error('read outside a unit bound to an organization');
    return bound;
  };

  const users: FactorSetUsers = {
    organizationsUsing: (pin: FactorSetPin) => Promise.resolve(world.usersOf[pin.revision] ?? []),
  };
  const audience: ReportUpdateAudience = {
    affectedReports: () => Promise.resolve(world.reportsOf?.[boundOrganization()] ?? []),
    editors: () => Promise.resolve(world.editorsOf?.[boundOrganization()] ?? [ANA]),
  };
  const labels = world.labels ?? { 1: '2026.1', 2: '2026.2' };
  const factorSets: FactorSets = {
    inForce: () => null,
    pinned: (pin: FactorSetPin) =>
      Promise.resolve(
        labels[pin.revision] === undefined ? null : { pin, label: labels[pin.revision], sources: new Map() },
      ),
  };
  const tenantWork: TenantWork = {
    inOrganization: async ({ organizationId }, work) => {
      bound = organizationId;
      try {
        return await work();
      } finally {
        bound = null;
      }
    },
  };
  const notifications: NotificationPort = {
    raise: (command) => {
      raised.push({ command, bound });
      order.push(`raise ${command.organizationId}`);
      return Promise.resolve({ notificationId: `n-${raised.length}` });
    },
    cancel: (command) => {
      cancelled.push({ command, bound });
      order.push(`cancel ${command.organizationId}`);
      return Promise.resolve();
    },
  };

  const useCase = new NotifyFactorSetReplaced(users, audience, factorSets, tenantWork, notifications);
  return { useCase, raised, cancelled, order };
};

const replaced = { country: 'md', leavingRevision: 1, enteringRevision: 2 };

describe('NotifyFactorSetReplaced (task 37.3)', () => {
  it('raises one notice naming the report, the set its run used and the set now in force, to its editors', async () => {
    const { useCase, raised } = build({
      usersOf: { 1: [ALPHA] },
      reportsOf: { [ALPHA]: [report('r-1')] },
      editorsOf: { [ALPHA]: [ANA, ION] },
    });

    await useCase.execute(replaced);

    expect(raised).toEqual([
      {
        bound: ALPHA,
        command: {
          categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
          organizationId: ALPHA,
          recipientUserIds: [ANA, ION],
          subjectRef: 'factor-set:md:1',
          deepLink: '/reports/r-1/calculator',
          params: {
            reach: 'one',
            setLabel: '2026.1',
            newSetLabel: '2026.2',
            entityName: 'Brutăria Lina SRL',
            fiscalYear: '2026',
          },
        },
      },
    ]);
  });

  it('says several and opens the reports list where more than one report is reached', async () => {
    const { useCase, raised } = build({
      usersOf: { 1: [ALPHA] },
      reportsOf: { [ALPHA]: [report('r-1'), report('r-2', 'Moara Veche SA')] },
    });

    await useCase.execute(replaced);

    expect(raised).toHaveLength(1);
    expect(raised[0].command.deepLink).toBe('/reports');
    expect(raised[0].command.params).toEqual({
      reach: 'several',
      setLabel: '2026.1',
      newSetLabel: '2026.2',
      entityName: '',
      fiscalYear: '',
    });
  });

  /** AC-3's second half: an organization no open report of which was last calculated on the set is told nothing. */
  it('raises nothing where an organization has runs on the set but no open report whose latest run used it', async () => {
    const { useCase, raised } = build({ usersOf: { 1: [ALPHA] }, reportsOf: { [ALPHA]: [] } });

    await useCase.execute(replaced);

    expect(raised).toEqual([]);
  });

  it('raises in each organization inside the unit bound to it, and only there', async () => {
    const { useCase, raised } = build({
      usersOf: { 1: [ALPHA, BETA] },
      reportsOf: { [ALPHA]: [report('r-1')], [BETA]: [report('r-9')] },
    });

    await useCase.execute(replaced);

    expect(raised.map(({ command, bound }) => [command.organizationId, bound])).toEqual([
      [ALPHA, ALPHA],
      [BETA, BETA],
    ]);
  });

  /** A revert (row (5)): the set restored withdraws the notices its earlier replacement opened, before any raise. */
  it('cancels, in each organization using the set entering, the notice about that set — before raising', async () => {
    const { useCase, cancelled, order } = build({
      usersOf: { 1: [ALPHA], 2: [BETA] },
      reportsOf: { [BETA]: [report('r-9')] },
    });

    await useCase.execute({ country: 'md', leavingRevision: 2, enteringRevision: 1 });

    expect(cancelled).toEqual([
      {
        bound: ALPHA,
        command: { categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE, organizationId: ALPHA, subjectRef: 'factor-set:md:1' },
      },
    ]);
    expect(order).toEqual([`cancel ${ALPHA}`, `raise ${BETA}`]);
  });

  it('throws rather than word a notice about a set it cannot name, raising nothing', async () => {
    const { useCase, raised } = build({
      usersOf: { 1: [ALPHA] },
      reportsOf: { [ALPHA]: [report('r-1')] },
      labels: { 1: '2026.1' },
    });

    await expect(useCase.execute(replaced)).rejects.toThrow('revision 2 is unreadable');
    expect(raised).toEqual([]);
  });
});
