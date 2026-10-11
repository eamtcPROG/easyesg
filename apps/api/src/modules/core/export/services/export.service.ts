import { Inject, Injectable } from '@nestjs/common';
import { LOCALES, type LabelStanding, type Locale } from '@easyesg/i18n';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import type { ListQueryInput } from '@api/contracts/types/list-query';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { commitTenantTransaction } from '@api/infrastructure/persistence/tenant-transaction';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { REPORT_STORE, type ReportStore } from '@api/modules/core/disclosure/interfaces/report-store.interface';
import { ValidationFindingDto } from '@api/modules/core/validation/dto/validation.dto';
import { ValidationService } from '@api/modules/core/validation/services/validation.service';
import { exportFileName } from '../domain/export-file-name';
import { toExportHistoryQuery } from '../domain/export-history-query';
import { ExportFindingsUnacknowledgedError, ExportNotFoundError } from '../errors/export.errors';
import { EXPORT_HISTORY, type ExportHistoryStore } from '../interfaces/export-history.interface';
import type { ExportHistoryPage } from '../models/export-history-query.model';
import type { ExportRecord } from '../models/export-record.model';
import { ReadExportFile } from '../use-cases/read-export-file.use-case';
import { EXPORT_REQUEST_OUTCOME, RequestExport, type RequestExportCommand } from '../use-cases/request-export.use-case';

/**
 * The Nest-aware seam over S-11's api (tasks 47.1, 47.4): the request, the history, one export and its file.
 *
 * **The request runs validation first and keeps the run** (§12.5.6's task-47 row (7)): `ValidationService` evaluates and
 * stores it on the request's transaction and names its findings as S-08 does; `RequestExport` then refuses or queues.
 * **A refusal commits before it is raised** — the filter rolls back whatever a refused request wrote, and the run is the
 * report's now, the one S-08 and readiness read — sign-in's *commit, then throw* on the request's own transaction.
 * Nothing of the export is written by then, so the commit keeps the run and nothing else.
 *
 * The reads go to the store directly, as the report's do: RLS scopes them and no rule applies.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly validation: ValidationService,
    private readonly requests: RequestExport,
    private readonly files: ReadExportFile,
    @Inject(EXPORT_HISTORY) private readonly history: ExportHistoryStore,
    @Inject(REPORT_STORE) private readonly reports: ReportStore,
    @Inject(DISCLOSURE_LABELS) private readonly labels: Pick<DisclosureLabelResolver, 'standing'>,
  ) {}

  async request(command: Omit<RequestExportCommand, 'unresolvedFindings'>): Promise<ExportRecord> {
    const reading = await this.validation.run({ reportId: command.reportId });
    const outcome = await this.requests.execute({ ...command, unresolvedFindings: reading.findings.length });
    if (outcome.kind === EXPORT_REQUEST_OUTCOME.REFUSED) {
      await commitTenantTransaction();
      throw new ExportFindingsUnacknowledgedError(reading.findings.map((finding) => new ValidationFindingDto(finding)));
    }
    return outcome.export;
  }

  async list(input: { readonly reportId: string; readonly list: ListQueryInput }): Promise<ExportHistoryPage & { readonly take: number }> {
    if (!(await this.reports.findReport({ reportId: input.reportId }))) throw new ReportNotFoundError();
    const query = toExportHistoryQuery({ reportId: input.reportId, list: input.list, fallbackTake: DEFAULT_ON_PAGE });
    return { ...(await this.history.list(query)), take: query.take };
  }

  /**
   * The languages a file may be written in, each with its labels' standing at the report's pinned version (task 47.3;
   * UX-47) — what the dialogue's caveat is drawn from, asked once per language as `standing` was shaped to be.
   */
  async languages(
    reportId: string,
  ): Promise<readonly { readonly locale: Locale; readonly labelStanding: LabelStanding | null }[]> {
    const report = await this.reports.findReport({ reportId });
    if (!report) throw new ReportNotFoundError();
    return LOCALES.map((locale) => ({
      locale,
      labelStanding: this.labels.standing({ version: report.taxonomyVersion, locale }),
    }));
  }

  async find(exportId: string): Promise<ExportRecord> {
    const stored = await this.history.find({ exportId });
    if (stored === null) throw new ExportNotFoundError();
    return stored.record;
  }

  /** The stored file, and the name it is saved under — the undertaking and the year from the report it was made of. */
  async file(exportId: string): Promise<{ readonly record: ExportRecord; readonly body: Buffer; readonly fileName: string }> {
    const { record, body } = await this.files.execute({ exportId });
    const report = await this.reports.findReport({ reportId: record.reportId });
    if (!report) throw new ExportNotFoundError();
    const fileName = exportFileName({
      entityName: report.subject.entityName,
      fiscalYear: report.subject.fiscalYear,
      locale: record.locale,
      format: record.format,
    });
    return { record, body, fileName };
  }
}
