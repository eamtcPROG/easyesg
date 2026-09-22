import { Inject, Injectable } from '@nestjs/common';
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
import { SendReportReminder, type SendReportReminderCommand } from '../use-cases/send-report-reminder.use-case';

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
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly reports: CreateReport,
    @Inject(REPORT_STORE) private readonly store: ReportStore,
    private readonly reminders: SendReportReminder,
  ) {}

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
