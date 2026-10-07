import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { FactorSetUsers } from '../interfaces/factor-set-users.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { ReportUpdateAudience } from '../interfaces/report-update-audience.interface';
import type { FactorSetPin } from '../models/factor-set.model';
import { REPORT_UPDATE_REACH, type AffectedReport, type ReportUpdateParams } from '../models/report-update.model';

export interface NotifyFactorSetReplacedCommand {
  /** The slot's scope — the country whose set it is, lower case. */
  readonly country: string;
  /** The revision that was in force for the window, and is no longer. */
  readonly leavingRevision: number;
  /** The revision now in force there — a new one, or an earlier one restored by a revert. */
  readonly enteringRevision: number;
}

/**
 * FR-166's factor half, UC-171 (task 37.3; `architecture.md` §12.5.6's task-37.3/37.4 rows (2) … (6)): a factor set
 * replaced in its window tells each organization with an open report calculated on it, once, that the figure must be
 * recalculated — and never recalculates anything itself (FR-35).
 *
 * **Two passes, each one organization at a time** through `TENANT_WORK`, so each organization's reads and its notice
 * share a transaction bound to it, and a failure in one rolls back that one alone:
 *
 * 1. **The revision entering withdraws its own notices** (row (5); FR-167). After a revert, an organization whose
 *    runs use the restored set has nothing left to recalculate, so the notice that set's earlier replacement opened is
 *    cancelled. For a new revision no run uses it yet, and the pass reaches nobody.
 * 2. **The revision leaving raises one notice per affected organization** (rows (3), (6)): one whose open reports'
 *    latest runs used it. The key's subject is that revision, so a job run twice folds into the notice it opened.
 *
 * Cancellation comes first because the two keys differ, and a cancellation of one key never touches another's raise.
 */
export class NotifyFactorSetReplaced {
  constructor(
    private readonly users: FactorSetUsers,
    private readonly audience: ReportUpdateAudience,
    private readonly factorSets: FactorSets,
    private readonly tenantWork: TenantWork,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: NotifyFactorSetReplacedCommand): Promise<void> {
    const leaving: FactorSetPin = { country: command.country, revision: command.leavingRevision };
    const entering: FactorSetPin = { country: command.country, revision: command.enteringRevision };

    for (const organizationId of await this.users.organizationsUsing(entering)) {
      await this.tenantWork.inOrganization({ organizationId }, () =>
        this.notifications.cancel({
          categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
          organizationId,
          subjectRef: subjectOf(entering),
        }),
      );
    }

    const organizations = await this.users.organizationsUsing(leaving);
    if (organizations.length === 0) return;

    const labels = { setLabel: await this.labelOf(leaving), newSetLabel: await this.labelOf(entering) };
    for (const organizationId of organizations) {
      await this.tenantWork.inOrganization({ organizationId }, () => this.raiseIn({ organizationId, leaving, labels }));
    }
  }

  private async raiseIn(input: {
    readonly organizationId: string;
    readonly leaving: FactorSetPin;
    readonly labels: Pick<ReportUpdateParams, 'setLabel' | 'newSetLabel'>;
  }): Promise<void> {
    const reports = await this.audience.affectedReports(input.leaving);
    // Runs on the revision, but none an open report's latest: nothing here is left to recalculate.
    if (reports.length === 0) return;

    const recipients = await this.audience.editors();
    if (recipients.length === 0) return;

    const [only] = reports;
    const one = reports.length === 1 ? only : null;
    await this.notifications.raise({
      categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
      organizationId: input.organizationId,
      recipientUserIds: [...recipients],
      subjectRef: subjectOf(input.leaving),
      deepLink: one === null ? '/reports' : `/reports/${one.reportId}/calculator`,
      params: paramsFor({ one, labels: input.labels }),
    });
  }

  /**
   * The label a reader knows the set by (UX-42). Both sets were published, and since task 37.4 a set no reader could
   * use is refused at publication — so an unreadable one here is a revision from before that rule, restored by a
   * revert. **It throws**, leaving the job in the failed set, visible and re-runnable, rather than word a notice about
   * a set it cannot name.
   */
  private async labelOf(pin: FactorSetPin): Promise<string> {
    const set = await this.factorSets.pinned(pin);
    if (set === null) {
      throw new Error(`Factor set ${pin.country} revision ${pin.revision} is unreadable; its replacement notice cannot name it.`);
    }
    return set.label;
  }
}

/** FR-167's subject: the revision the runs used, so one replacement of it is one notice per organization. */
const subjectOf = (pin: FactorSetPin): string => `factor-set:${pin.country}:${pin.revision}`;

function paramsFor(input: {
  readonly one: AffectedReport | null;
  readonly labels: Pick<ReportUpdateParams, 'setLabel' | 'newSetLabel'>;
}): ReportUpdateParams {
  return input.one === null
    ? { reach: REPORT_UPDATE_REACH.SEVERAL, ...input.labels, entityName: '', fiscalYear: '' }
    : {
        reach: REPORT_UPDATE_REACH.ONE,
        ...input.labels,
        entityName: input.one.entityName,
        fiscalYear: String(input.one.fiscalYear),
      };
}
