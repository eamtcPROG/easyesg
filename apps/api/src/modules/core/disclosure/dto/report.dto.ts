import { ENTITY_STATUS, type EntityStatus } from '@api/modules/core/entity/models/reporting-entity.model';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  REPORT_SCOPE,
  REPORT_STATUS,
  statusAsRead,
  type Report,
  type ReportScope,
  type ReportStatus,
  type ReportSubject,
} from '../models/report.model';
import { ReportValidationSummaryDto } from './report-validation-summary.dto';
import { ReportFilingDto } from './report-filing.dto';
import { type SupersedingPin, supersedingPin } from '../domain/superseding-pin';
import type { TaxonomyPin } from '@api/contracts/taxonomy-registry.port';
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
  /*
   * **No `default:` in the schema.** openapi-typescript treats a property carrying a default as
   * always present and emits it as REQUIRED, so the generated client would oblige every caller to
   * send a field this schema's own `required` list omits. The default is stated in the description,
   * where a reader needs it, and applied where it can actually be applied — in the use case.
   * (Found on `SignInRequestDto` at task 97, swept here at task 32.3; these two were the only
   * request properties in the whole spec carrying a default.)
   */
  @ApiPropertyOptional({
    enum: SCOPES,
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

  @ApiProperty({
    enum: Object.values(ENTITY_STATUS),
    description:
      'The standing of the entity the report is for (task 214). A report on an archived entity is read-only: it takes ' +
      'no write to its answers and cannot be deleted, and can still be checked, exported and marked filed (FR-20).',
  })
  readonly entityStatus: EntityStatus;

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
    this.entityStatus = subject.entityStatus;
    this.fiscalYear = subject.fiscalYear;
    this.periodStart = subject.periodStart;
    this.periodEnd = subject.periodEnd;
    this.dueDate = subject.dueDate;
  }
}

/** The versions a report's pin is superseded by (task 47; FR-51; §12.5.6's task-47 row (6)). */
export class SupersedingPinDto implements SupersedingPin {
  @ApiProperty({ example: '2026-05-01', description: 'The VSME taxonomy release a new report would pin today.' })
  readonly taxonomyVersion: string;

  @ApiProperty({ example: '1.3.0', description: 'The EFRAG Digital Template release a new report would pin today.' })
  readonly templateVersion: string;

  constructor(pin: SupersedingPin) {
    this.taxonomyVersion = pin.taxonomyVersion;
    this.templateVersion = pin.templateVersion;
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
      'their only writer (FR-22). An open report whose latest validation run left nothing outstanding ' +
      'reads ready to file (FR-41, 182/19) — read, never written. A report its reporter marked filed reads ' +
      'filed, whether its period is open or locked (task 47.5).',
  })
  readonly status: ReportStatus;

  @ApiProperty({
    description:
      'Whether the report’s period is locked (FR-22), so it takes no writes from anyone — whatever its status reads: ' +
      'a filed report in a locked period reads filed (task 47.5).',
  })
  readonly locked: boolean;

  @ApiProperty({
    description:
      'Whether a file of it was exported or is being made — an export requested or completed, never one that failed. ' +
      'Such a report is distribution evidence, and the Organization Administrator cannot delete it (FR-210).',
  })
  readonly exported: boolean;

  @ApiProperty({
    type: ReportValidationSummaryDto,
    nullable: true,
    description: 'What its latest validation run came to (FR-41), or null where it was never checked.',
  })
  readonly validation: ReportValidationSummaryDto | null;

  @ApiProperty({
    type: ReportFilingDto,
    nullable: true,
    description: 'The reporter’s filed mark (FR-41), or null where it was never marked or the mark was withdrawn.',
  })
  readonly filing: ReportFilingDto | null;

  @ApiProperty({
    type: SupersedingPinDto,
    nullable: true,
    description:
      'The versions a new report would pin today, where they differ from this report’s pin (FR-51) — or null where its ' +
      'pin is current. An export always uses the report’s own pin.',
  })
  readonly supersededBy: SupersedingPinDto | null;

  @ApiProperty({
    // EFRAG's own release identifier since task 45.3, which this example had not followed.
    example: '1.3.0',
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

  /** `adopted` is what a new report would pin today — every route answering a report passes it, so none can omit it. */
  constructor(report: Report, adopted: TaxonomyPin | null) {
    this.id = report.id;
    this.reportingPeriodId = report.reportingPeriodId;
    this.scope = report.scope;
    this.status = statusAsRead({ ...report, filed: report.filing !== null });
    this.locked = report.status === REPORT_STATUS.LOCKED;
    this.exported = report.exported;
    this.validation = report.validation === null ? null : new ReportValidationSummaryDto(report.validation);
    this.filing = report.filing === null ? null : new ReportFilingDto(report.filing);
    const superseding: SupersedingPin | null = supersedingPin({ report, adopted });
    this.supersededBy = superseding === null ? null : new SupersedingPinDto(superseding);
    this.templateVersion = report.templateVersion;
    this.taxonomyVersion = report.taxonomyVersion;
    // The one conversion OQ-50 permits, at the persistence-to-DTO boundary.
    this.createdAt = report.createdAt.getTime();
    this.updatedAt = report.updatedAt.getTime();
    this.subject = new ReportSubjectDto(report.subject);
  }
}
