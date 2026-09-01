import { ApiProperty } from '@nestjs/swagger';
import { DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { DisclosureState } from '@api/modules/core/disclosure/models/disclosure-value.model';
import {
  COMPARABILITY,
  PRIOR_PERIOD_AVAILABILITY,
} from '../models/prior-period-value.model';
import type {
  Comparability,
  PriorPeriodAvailability,
  PriorPeriodComparatives,
  PriorPeriodValue,
  PriorReportPin,
} from '../models/prior-period-value.model';

/**
 * Every enumeration is derived from its `as const`, never restated (CLAUDE.md). Declaration order
 * becomes contract order, so a reordering is a diff `openapi:check` fails on rather than a silent
 * change to the published enum.
 */
const COMPARABILITIES = Object.values(COMPARABILITY);
const AVAILABILITIES = Object.values(PRIOR_PERIOD_AVAILABILITY);
const STATES = Object.values(DISCLOSURE_STATE);

export class PriorReportPinDto {
  @ApiProperty({ format: 'uuid' })
  readonly reportId: string;

  @ApiProperty({ format: 'uuid' })
  readonly periodId: string;

  @ApiProperty({ example: 2025, description: 'The fiscal year the comparative was reported for.' })
  readonly fiscalYear: number;

  @ApiProperty({
    example: '2026-05-01',
    description:
      'The taxonomy version the prior report was authored under. Present because it may differ ' +
      'from the current report’s (DR-4), which is what `comparability` is about.',
  })
  readonly taxonomyVersion: string;

  constructor(pin: PriorReportPin) {
    this.reportId = pin.reportId;
    this.periodId = pin.periodId;
    this.fiscalYear = pin.fiscalYear;
    this.taxonomyVersion = pin.taxonomyVersion;
  }
}

export class PriorPeriodValueDto {
  @ApiProperty({ example: 'NumberOfEmployeesInHeadcount' })
  readonly elementKey: string;

  @ApiProperty({ description: 'An axis member, or empty where the element is undimensioned.' })
  readonly dimensionKey: string;

  @ApiProperty({ description: 'Position within a repeating group; 0 where there is none.' })
  readonly ordinal: number;

  @ApiProperty({ nullable: true, type: String, description: 'Decimal as a string, never a float.' })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String, example: '2025-12-31' })
  readonly valueDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly unitCode: string | null;

  @ApiProperty({ enum: STATES })
  readonly state: DisclosureState;

  @ApiProperty({
    enum: COMPARABILITIES,
    description:
      'Whether this value can be placed beside the current field. A fact read from the two pinned ' +
      'taxonomy versions, not a decision about what to render.',
  })
  readonly comparability: Comparability;

  constructor(value: PriorPeriodValue) {
    this.elementKey = value.elementKey;
    this.dimensionKey = value.dimensionKey;
    this.ordinal = value.ordinal;
    this.valueNumeric = value.valueNumeric;
    this.valueText = value.valueText;
    this.valueBoolean = value.valueBoolean;
    this.valueDate = value.valueDate;
    this.unitCode = value.unitCode;
    this.state = value.state;
    this.comparability = value.comparability;
  }
}

export class PriorPeriodResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly reportId: string;

  @ApiProperty({ example: '2026-05-01', description: 'The current report’s pinned taxonomy version.' })
  readonly taxonomyVersion: string;

  @ApiProperty({
    enum: AVAILABILITIES,
    description:
      'Why there is nothing to show, where there is nothing. A first year and a prior period ' +
      'nobody reported on are different situations for a reporter (FR-45).',
  })
  readonly availability: PriorPeriodAvailability;

  @ApiProperty({ type: PriorReportPinDto, nullable: true })
  readonly prior: PriorReportPinDto | null;

  @ApiProperty({ type: [PriorPeriodValueDto] })
  readonly values: PriorPeriodValueDto[];

  constructor(comparatives: PriorPeriodComparatives) {
    this.reportId = comparatives.reportId;
    this.taxonomyVersion = comparatives.taxonomyVersion;
    this.availability = comparatives.availability;
    this.prior = comparatives.prior === null ? null : new PriorReportPinDto(comparatives.prior);
    this.values = comparatives.values.map((value) => new PriorPeriodValueDto(value));
  }
}
