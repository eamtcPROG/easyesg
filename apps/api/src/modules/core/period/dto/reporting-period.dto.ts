import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';
import type { LegalDate } from '@api/contracts/types/time';
import type { ReportingPeriod } from '../models/reporting-period.model';

/** ISO 8601 calendar date. Shape only — that it names a real day is a domain rule. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/u;
/** IANA zone shape, e.g. `Europe/Chisinau`, `UTC`. Membership is checked against `Intl`. */
const IANA_ZONE = /^[A-Za-z0-9+_-]+(\/[A-Za-z0-9+_.-]+)*$/u;

/**
 * A calendar date with the zone that determines it — NFR-34's pairing, on the wire.
 *
 * **An object rather than two sibling fields**, so the zone cannot be forgotten: `periodStart` and a
 * separate `periodStartTimezone` are two optional-looking strings a caller can half-supply, and the
 * whole requirement is that a legal date never travels without its zone.
 */
export class LegalDateDto implements LegalDate {
  @ApiProperty({ example: '2026-01-01', description: 'ISO 8601 calendar date. No time, no offset.' })
  @Trim()
  @IsString()
  @Matches(CALENDAR_DATE)
  date!: string;

  @ApiProperty({
    example: 'Europe/Chisinau',
    description: 'IANA zone that determines the date. Admitted against the runtime tz database.',
  })
  @Trim()
  @IsString()
  @Matches(IANA_ZONE)
  timezone!: string;
}

export class OpenReportingPeriodRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  reportingEntityId!: string;

  /**
   * **Stated rather than derived from the dates.** FR-21 names it beside them because a fiscal year
   * straddling two calendar years is labelled by the undertaking, not by arithmetic.
   */
  @ApiProperty({ minimum: 1900, maximum: 2200, example: 2026 })
  @IsInt()
  @Min(1900)
  @Max(2200)
  fiscalYear!: number;

  @ApiProperty({ type: LegalDateDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  periodStart!: LegalDateDto;

  @ApiProperty({ type: LegalDateDto, description: 'The last day IN the period, not the day after.' })
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  periodEnd!: LegalDateDto;

  @ApiPropertyOptional({
    type: LegalDateDto,
    nullable: true,
    description:
      'When the report must be complete — a different fact from when the period ends, and what ' +
      'deadline notices count down to.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  dueDate?: LegalDateDto | null;
}

/**
 * The editable half of the shell.
 *
 * **`templateVersion` and `taxonomyVersion` are absent, and their absence is DR-4.** The pin is
 * resolved at open and moves only by an explicit migration run (FR-69); a patch field for it would
 * make "never moves silently" a convention rather than a property of the surface.
 *
 * `reportingEntityId` is absent for a different reason: moving a period to another entity is not an
 * edit, it is a different period.
 */
export class UpdateReportingPeriodRequestDto {
  @ApiPropertyOptional({ minimum: 1900, maximum: 2200 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  fiscalYear?: number;

  @ApiPropertyOptional({ type: LegalDateDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  periodStart?: LegalDateDto;

  @ApiPropertyOptional({ type: LegalDateDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  periodEnd?: LegalDateDto;

  @ApiPropertyOptional({ type: LegalDateDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => LegalDateDto)
  dueDate?: LegalDateDto | null;
}

export class ReportingPeriodResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly reportingEntityId: string;

  @ApiProperty({ example: 2026 })
  readonly fiscalYear: number;

  @ApiProperty({ type: LegalDateDto })
  readonly periodStart: LegalDate;

  @ApiProperty({ type: LegalDateDto })
  readonly periodEnd: LegalDate;

  @ApiProperty({ type: LegalDateDto, nullable: true })
  readonly dueDate: LegalDate | null;

  @ApiProperty({
    example: '2026-05-01',
    description: 'The EFRAG Digital Template release this period is pinned to (DR-4, FR-66).',
  })
  readonly templateVersion: string;

  @ApiProperty({
    example: '2026-05-01',
    description: 'The VSME taxonomy release this period is pinned to (DR-4, FR-66).',
  })
  readonly taxonomyVersion: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'The immediately preceding period for the same entity, from which comparatives resolve ' +
      '(FR-45). Null for an entity’s first period.',
  })
  readonly priorPeriodId: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The entity master data as it stood when this period was opened (FR-18).',
  })
  readonly entitySnapshotId: string | null;

  @ApiProperty({ description: 'Unix epoch milliseconds, UTC.' })
  readonly createdAt: number;

  @ApiProperty({ description: 'Unix epoch milliseconds, UTC.' })
  readonly updatedAt: number;

  constructor(period: ReportingPeriod) {
    this.id = period.id;
    this.reportingEntityId = period.reportingEntityId;
    this.fiscalYear = period.fiscalYear;
    this.periodStart = period.periodStart;
    this.periodEnd = period.periodEnd;
    this.dueDate = period.dueDate;
    this.templateVersion = period.templateVersion;
    this.taxonomyVersion = period.taxonomyVersion;
    this.priorPeriodId = period.priorPeriodId;
    this.entitySnapshotId = period.entitySnapshotId;
    // The one conversion OQ-50 permits, at the persistence-to-DTO boundary. The period's own
    // boundaries stay calendar dates and are deliberately NOT converted — that is the distinction
    // NFR-34 draws, visible in one object.
    this.createdAt = period.createdAt.getTime();
    this.updatedAt = period.updatedAt.getTime();
  }
}
