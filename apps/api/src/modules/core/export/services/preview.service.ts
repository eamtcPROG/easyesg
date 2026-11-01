import { Injectable } from '@nestjs/common';
import { PreviewReport, type PreviewReportQuery } from '../use-cases/preview-report.use-case';

/**
 * The Nest-aware seam over UC-41's preview (task 43.1). The language is the caller's choice and never the request's
 * negotiated one — the document is in the export's language (FR-52, 182/34) — so there is no ambient context to resolve.
 */
@Injectable()
export class PreviewService {
  constructor(private readonly previews: PreviewReport) {}

  preview(query: PreviewReportQuery): Promise<string> {
    return this.previews.execute(query);
  }
}
