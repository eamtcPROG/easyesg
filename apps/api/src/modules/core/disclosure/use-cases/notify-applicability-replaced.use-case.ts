import { NOTIFICATION_CATEGORY, type NotificationPort } from '@api/contracts/notification.port';
import { REPORT_UPDATE_CAUSE, REPORT_UPDATE_REACH, type ReportUpdateParams } from '@api/contracts/report-update';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { applicabilityMoved } from '../domain/applicability-change';
import type {
  ApplicabilityHistory,
  OpenReportDirectory,
  ReportUpdateSubjects,
} from '../interfaces/applicability-notice.interface';
import type { ApplicabilityRule } from '../models/applicability.model';

export interface NotifyApplicabilityReplacedCommand {
  /** The slot's scope — the standard whose rules they are. */
  readonly standard: string;
  readonly leavingRevision: number;
  readonly enteringRevision: number;
}

/** What evaluating one report under a set of rules answers — `ReadWizardStep.applicabilityUnder`'s shape. */
export interface ReportApplicability {
  applicabilityUnder(query: {
    readonly reportId: string;
    readonly rules: readonly ApplicabilityRule[];
  }): Promise<ReadonlyMap<string, boolean>>;
}

/**
 * FR-166's threshold half, UC-81 (task 67.8; 182/135 … 182/137): an applicability rule set replaced in force tells each
 * organization **whose open report it obliges** — where the old rules and the new judge a field differently over the
 * report's own stored answers — once, to its editors, that the report asks for other sections than before. Nothing is
 * changed in any report: the wizard reads the new rules on its next read.
 *
 * **One organization at a time** through `TENANT_WORK`, so each organization's reads and its notice share a
 * transaction bound to it. The subject is the revision entering, so a job run twice folds into the notice it opened
 * (FR-167). A revision that cannot be read **throws**, leaving the job failed and re-runnable rather than guessing.
 */
export class NotifyApplicabilityReplaced {
  constructor(
    private readonly history: ApplicabilityHistory,
    private readonly directory: OpenReportDirectory,
    private readonly reports: ReportApplicability,
    private readonly subjects: ReportUpdateSubjects,
    private readonly tenantWork: TenantWork,
    private readonly notifications: NotificationPort,
  ) {}

  async execute(command: NotifyApplicabilityReplacedCommand): Promise<void> {
    const before = await this.rulesAt(command.standard, command.leavingRevision);
    const after = await this.rulesAt(command.standard, command.enteringRevision);

    for (const { organizationId, reportIds } of await this.directory.openReports()) {
      await this.tenantWork.inOrganization({ organizationId }, async () => {
        const obliged: string[] = [];
        for (const reportId of reportIds) {
          const moved = applicabilityMoved({
            before: await this.reports.applicabilityUnder({ reportId, rules: before }),
            after: await this.reports.applicabilityUnder({ reportId, rules: after }),
          });
          if (moved) obliged.push(reportId);
        }
        if (obliged.length === 0) return;

        const recipients = await this.subjects.editors();
        if (recipients.length === 0) return;
        const [one] = obliged.length === 1 ? await this.subjects.subjects({ reportIds: obliged }) : [];
        await this.notifications.raise({
          categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
          organizationId,
          recipientUserIds: [...recipients],
          subjectRef: `applicability/${command.standard}/${command.enteringRevision}`,
          deepLink: one === undefined ? '/reports' : `/reports/${one.reportId}`,
          params: paramsFor(one),
        });
      });
    }
  }

  private async rulesAt(standard: string, revision: number): Promise<readonly ApplicabilityRule[]> {
    const rules = await this.history.rulesAt({ standard, revision });
    if (rules === null) {
      throw new Error(`Applicability rules ${standard} revision ${revision} are unreadable; the change cannot be compared.`);
    }
    return rules;
  }
}

function paramsFor(one: { readonly entityName: string; readonly fiscalYear: number } | undefined): ReportUpdateParams {
  return {
    cause: REPORT_UPDATE_CAUSE.THRESHOLD,
    reach: one === undefined ? REPORT_UPDATE_REACH.SEVERAL : REPORT_UPDATE_REACH.ONE,
    version: '',
    setLabel: '',
    newSetLabel: '',
    entityName: one?.entityName ?? '',
    fiscalYear: one === undefined ? '' : String(one.fiscalYear),
  };
}
