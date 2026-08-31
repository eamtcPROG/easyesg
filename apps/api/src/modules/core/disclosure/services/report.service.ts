import { Inject, Injectable } from '@nestjs/common';
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

/**
 * The Nest-aware seam between `ReportsController` and the use case (house rule: controllers call
 * services, services call use cases).
 *
 * The reads go straight to the store because there is no use case in them — RLS scopes the
 * statement and no rule applies. The writes carry UC-18's precondition and DR-4's pin, which is
 * where `CreateReport` earns its place.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly reports: CreateReport,
    @Inject(REPORT_STORE) private readonly store: ReportStore,
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
}
