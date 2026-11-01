import { ApiProperty } from '@nestjs/swagger';
import type { ReportFiles } from '../models/report.model';

/**
 * A report's finished files, as S-06's filed row draws them (task 216; FR-53's behaviour 8; §12.5.6's task-216 row) —
 * how many completed, and the one *Download* fetches through `GET /exports/{id}/file`. Read with the report, so a list
 * asks nothing per row.
 */
export class ReportFilesDto implements ReportFiles {
  @ApiProperty({
    minimum: 0,
    description: 'How many of its exports completed — the files there are to download. A failed or running one is not counted.',
  })
  readonly count: number;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The export completed last, whatever its format and language — the file S-06 downloads — or null where none has ' +
      'completed.',
  })
  readonly latestExportId: string | null;

  constructor(files: ReportFiles) {
    this.count = files.count;
    this.latestExportId = files.latestExportId;
  }
}
