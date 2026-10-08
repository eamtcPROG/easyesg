import { ApiProperty } from '@nestjs/swagger';
import type { ReportValidationSummary } from '../models/report.model';

/**
 * What a report's latest validation run came to, as S-06's and S-05's lists draw it (task 42.2; FR-23 AC-7, FR-25 AC-3)
 * — counts, never a percentage (182/18), read as the run left it (182/26).
 */
export class ReportValidationSummaryDto implements ReportValidationSummary {
  @ApiProperty({ minimum: 0, description: 'The modules the run found complete — nothing outstanding, something answered.' })
  readonly modulesComplete: number;

  @ApiProperty({
    minimum: 0,
    description: 'The modules the run counted: every module the report asks and has not omitted, waiting ones included.',
  })
  readonly modulesCounted: number;

  @ApiProperty({ minimum: 0, description: 'The fields the run left carrying a finding.' })
  readonly outstanding: number;

  constructor(summary: ReportValidationSummary) {
    this.modulesComplete = summary.modulesComplete;
    this.modulesCounted = summary.modulesCounted;
    this.outstanding = summary.outstanding;
  }
}
