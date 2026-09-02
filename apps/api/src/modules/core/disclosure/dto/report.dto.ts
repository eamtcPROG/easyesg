import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  DEFAULT_REPORT_SCOPE,
  REPORT_SCOPE,
  REPORT_STATUS,
  type Report,
  type ReportScope,
  type ReportStatus,
  type ReportSubject,
} from '../models/report.model';
import { LegalDateDto } from '@api/modules/core/period/dto/reporting-period.dto';
import type { EpochMillis, LegalDate } from '@api/contracts/types/time';

/**
 * OpenAPI can type an instant only as `integer`, so the unit has to be stated in prose on every one
 * of them — CLAUDE.md's rule, and the reason this sentence repeats rather than being omitted.
 */
const EPOCH_MILLIS = 'Unix epoch milliseconds, UTC.';

/**
 * Every enum on this surface is derived from its `as const`, never restated. Declaration order is
 * therefore contract order, so reordering the vocabulary shows up in the OpenAPI diff (CLAUDE.md).
 */
const SCOPES = Object.values(REPORT_SCOPE);
const STATUSES = Object.values(REPORT_STATUS);

export class CreateReportRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The reporting period this report covers. A period carries at most one report, and the ' +
      'period is what determines the pinned versions (FR-66, DR-4).',
  })
  @IsUUID()
  reportingPeriodId!: string;

  /**
   * **The only field of substance on this request, and the pins are absent beside it.** DR-4 makes
   * the template and taxonomy version the period's to determine; a request field naming one would
   * let a caller pin a filing to a version of their choosing.
   */
  @ApiPropertyOptional({
    enum: SCOPES,
    default: DEFAULT_REPORT_SCOPE,
    description:
      'Which VSME modules this report covers. Comprehensive is additive over Basic and may also ' +
      'be added later (FR-177). Defaults to Basic.',
  })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: ReportScope;
}

/**
 * The editable half of a report.
 *
 * **`templateVersion` and `taxonomyVersion` are absent, and their absence is DR-4** — as it is on
 * `UpdateReportingPeriodRequestDto`, and with a stronger guarantee behind it here: the application
 * role holds no `UPDATE` privilege on either column, so the pin could not move even if a field for
 * it appeared.
 *
 * `status` is absent because the period lock is its only writer (§12.5.6's task-31.3 row), and
 * `reportingPeriodId` because moving a report to another period is not an edit, it is a different
 * report.
 */
export class UpdateReportRequestDto {
  @ApiPropertyOptional({
    enum: SCOPES,
    description: 'FR-177: Comprehensive may be added to a report already in progress.',
  })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: ReportScope;
}

/**
 * What a report is about — the entity and period it covers (task 32.2).
 *
 * **A read projection resolved by join, not a stored copy.** S-06's purpose is finding the
 * entity/period combination to work on, and a row answering `reportingPeriodId` alone is a list of
 * identifiers. Present on the record as well as the list, so a creation flow and the record it
 * lands on cannot read different shapes.
 */
export class ReportSubjectDto {
  @ApiProperty({ format: 'uuid' })
  readonly reportingEntityId: string;

  @ApiProperty({
    description:
      'The undertaking’s name as it stands now — a wayfinding label. What a filing discloses comes ' +
      'from the period’s point-in-time snapshot instead (FR-18).',
  })
  readonly entityName: string;

  @ApiProperty({ example: 2026 })
  readonly fiscalYear: number;

  @ApiProperty({ type: LegalDateDto })
  readonly periodStart: LegalDate;

  @ApiProperty({ type: LegalDateDto })
  readonly periodEnd: LegalDate;

  @ApiProperty({ type: LegalDateDto, nullable: true })
  readonly dueDate: LegalDate | null;

  constructor(subject: ReportSubject) {
    this.reportingEntityId = subject.reportingEntityId;
    this.entityName = subject.entityName;
    this.fiscalYear = subject.fiscalYear;
    this.periodStart = subject.periodStart;
    this.periodEnd = subject.periodEnd;
    this.dueDate = subject.dueDate;
  }
}

export class ReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly reportingPeriodId: string;

  @ApiProperty({ enum: SCOPES })
  readonly scope: ReportScope;

  @ApiProperty({
    enum: STATUSES,
    description:
      'Where the report stands. Open and locked follow the reporting period’s lock, which is ' +
      'their only writer (FR-22).',
  })
  readonly status: ReportStatus;

  @ApiProperty({
    example: '2026-05-01',
    description:
      'The EFRAG Digital Template release this report is pinned to (DR-4, FR-66). Copied from the ' +
      'reporting period at creation and moved only by an explicit migration run (FR-69).',
  })
  readonly templateVersion: string;

  @ApiProperty({
    example: '2026-05-01',
    description: 'The VSME taxonomy release this report is pinned to (DR-4, FR-66).',
  })
  readonly taxonomyVersion: string;

  @ApiProperty({ type: Number, description: EPOCH_MILLIS })
  readonly createdAt: EpochMillis;

  @ApiProperty({ type: Number, description: EPOCH_MILLIS })
  readonly updatedAt: EpochMillis;

  @ApiProperty({ type: ReportSubjectDto })
  readonly subject: ReportSubjectDto;

  constructor(report: Report) {
    this.id = report.id;
    this.reportingPeriodId = report.reportingPeriodId;
    this.scope = report.scope;
    this.status = report.status;
    this.templateVersion = report.templateVersion;
    this.taxonomyVersion = report.taxonomyVersion;
    // The one conversion OQ-50 permits, at the persistence-to-DTO boundary.
    this.createdAt = report.createdAt.getTime();
    this.updatedAt = report.updatedAt.getTime();
    this.subject = new ReportSubjectDto(report.subject);
  }
}
