import { Inject, Injectable } from '@nestjs/common';
import { TAXONOMY_REGISTRY, type TaxonomyPin, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { Report } from '../models/report.model';
import { REPORT_STORE, type ReportStore } from '../interfaces/report-store.interface';
import { ReportNotFoundError } from '../errors/report.errors';
// A value import, not `import type` — Nest reads `design:paramtypes` from the value graph, and an
// erased type-only import leaves `Function` in the metadata (see `PeriodService`'s note).
import {
  CreateReport,
  type CreateReportCommand,
  type UpdateReportCommand,
} from '../use-cases/create-report.use-case';
import { MarkReportFiled, type MarkReportFiledCommand } from '../use-cases/mark-report-filed.use-case';
import { SendReportReminder, type SendReportReminderCommand } from '../use-cases/send-report-reminder.use-case';
import { WithdrawReportFiling } from '../use-cases/withdraw-report-filing.use-case';
import { DeleteReport } from '../use-cases/delete-report.use-case';

/**
 * The Nest-aware seam between `ReportsController` and the use case (house rule: controllers call
 * services, services call use cases).
 *
 * The reads go straight to the store because there is no use case in them — RLS scopes the
 * statement and no rule applies. The writes carry UC-18's precondition and DR-4's pin, which is
 * where `CreateReport` earns its place.
 *
 * **UC-175's reminder takes its sender and organization from the request** (task 50.3), `PeriodService`'s rule for
 * who locked a period: an attribution a caller could name is not an attribution.
 *
 * **UC-213's deletion** (task 192) takes its organization from the request too, for the notice it withdraws.
 *
 * **FR-41's filed mark** (task 47.5) is made and withdrawn here, and `adopted()` says what a new report would pin today,
 * which every route answering a report states beside it (FR-51; §12.5.6's task-47 row (6)).
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly reports: CreateReport,
    @Inject(REPORT_STORE) private readonly store: ReportStore,
    private readonly reminders: SendReportReminder,
    private readonly marking: MarkReportFiled,
    private readonly withdrawing: WithdrawReportFiling,
    private readonly deleting: DeleteReport,
    @Inject(TAXONOMY_REGISTRY) private readonly registry: TaxonomyRegistry,
  ) {}

  /** What a new report would pin today — the adoption a report's own pin is compared with (FR-51). */
  adopted(): TaxonomyPin | null {
    return this.registry.pinFor({});
  }

  markFiled(command: MarkReportFiledCommand): Promise<Report> {
    return this.marking.execute(command);
  }

  withdrawFiling(command: { readonly reportId: string }): Promise<Report> {
    return this.withdrawing.execute(command);
  }

  list(input: { readonly reportingEntityId?: string }): Promise<Report[]> {
    return this.store.listReports(input);
  }

  async view(reportId: string): Promise<Report> {
    const report = await this.store.findReport({ reportId });
    if (!report) throw new ReportNotFoundError();
    return report;
  }

  create(command: CreateReportCommand): Promise<Report> {
    return this.reports.create(command);
  }

  update(command: UpdateReportCommand): Promise<Report> {
    return this.reports.update(command);
  }

  /** UC-213 (task 192): the organization is the request's, for the notice the deletion withdraws. */
  delete(command: { readonly reportId: string }): Promise<void> {
    const organizationId = requestContext()?.organizationId;
    // The tenant transaction has bound it before a controller runs; its absence is not a refusal to word.
    if (organizationId === undefined) throw new Error('A report was deleted with no organization bound');
    return this.deleting.execute({ reportId: command.reportId, organizationId });
  }

  remind(command: Omit<SendReportReminderCommand, 'senderAccountId' | 'organizationId'>): Promise<void> {
    const context = requestContext();
    // `AuthGuard` and the tenant transaction have bound both before a controller runs; neither is a refusal to word.
    if (context?.actorId === undefined || context.organizationId === undefined) {
      throw new Error('A reminder was sent with no actor or organization bound');
    }
    return this.reminders.execute({
      ...command,
      senderAccountId: context.actorId,
      organizationId: context.organizationId,
    });
  }
}
