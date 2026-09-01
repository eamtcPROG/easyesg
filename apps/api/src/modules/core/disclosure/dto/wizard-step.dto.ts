import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { PERIOD_TYPE } from '@api/contracts/taxonomy-registry.port';
import {
  DISCLOSURE_STATE,
  type DisclosureState,
  type DisclosureValue,
} from '../models/disclosure-value.model';
import type {
  DisclosureField,
  DisclosureModuleSummary,
  DisclosureStep,
} from '../models/wizard-step.model';

const STATES = Object.values(DISCLOSURE_STATE);
const KINDS = Object.values(DISCLOSURE_KIND);
const PERIOD_TYPES = Object.values(PERIOD_TYPE);

/**
 * **A batch is bounded.** FR-38 queues offline changes and flushes them on reconnect, so the size of
 * one write is set by how long someone worked offline rather than by a form. Unbounded, that is an
 * authenticated request whose cost the caller chooses; 143 is every reportable element of a version,
 * which is the largest honest flush.
 */
const MAX_VALUES_PER_WRITE = 143;

export class DisclosureModuleSummaryDto {
  @ApiProperty({ example: 'B8', description: "The standard's own module." })
  readonly module: string;

  @ApiProperty({ description: 'Fields with a stored answer, including nil return and not available.' })
  readonly answered: number;

  @ApiProperty({ description: 'Fields the pinned version puts in this module.' })
  readonly total: number;

  constructor(summary: DisclosureModuleSummary) {
    this.module = summary.module;
    this.answered = summary.answered;
    this.total = summary.total;
  }
}

export class DisclosureFieldDto {
  @ApiProperty({ example: 'NumberOfEmployees' })
  readonly elementKey: string;

  @ApiProperty({ description: 'An axis member, or empty where the element is undimensioned.' })
  readonly dimensionKey: string;

  @ApiProperty({ description: 'Position within a repeating group; 0 where there is none.' })
  readonly ordinal: number;

  @ApiProperty({ enum: KINDS, description: 'Which of the typed columns this element answers into.' })
  readonly kind: string;

  @ApiProperty({
    enum: PERIOD_TYPES,
    description:
      'Reported FOR the period (duration) or AS AT a moment in it (instant). The two compare ' +
      'differently against the prior period.',
  })
  readonly periodType: string;

  @ApiProperty({ type: [String], description: 'Axes this element is dimensioned along; empty for most.' })
  readonly axes: string[];

  @ApiProperty({ description: "EFRAG's own presentation order within the module." })
  readonly order: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Null where the pinned version carries no label for this element in this locale.',
  })
  readonly label: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "Whether the wording is EFRAG's own or platform-authored. Carried per field because it " +
      'travels with the text — of three locales only English is official.',
  })
  readonly labelStanding: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Decimal as a string, never a float.' })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String, example: '2026-12-31' })
  readonly valueDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly unitCode: string | null;

  @ApiProperty({ enum: STATES })
  readonly state: DisclosureState;

  @ApiProperty({ nullable: true, type: String })
  readonly notAvailableReason: string | null;

  @ApiProperty({ description: 'Carried forward from the prior period, and marked for review.' })
  readonly carriedForward: boolean;

  constructor(field: DisclosureField) {
    this.elementKey = field.elementKey;
    this.dimensionKey = field.dimensionKey;
    this.ordinal = field.ordinal;
    this.kind = field.kind;
    this.periodType = field.periodType;
    this.axes = [...field.axes];
    this.order = field.order;
    this.label = field.label;
    this.labelStanding = field.labelStanding;
    this.valueNumeric = field.valueNumeric;
    this.valueText = field.valueText;
    this.valueBoolean = field.valueBoolean;
    this.valueDate = field.valueDate;
    this.unitCode = field.unitCode;
    this.state = field.state;
    this.notAvailableReason = field.notAvailableReason;
    this.carriedForward = field.carriedForward;
  }
}

export class DisclosureStepDto {
  @ApiProperty({ example: 'B8' })
  readonly module: string;

  @ApiProperty({
    example: '2026-05-01',
    description: "The report's own pinned version, which is what these fields were resolved from.",
  })
  readonly taxonomyVersion: string;

  @ApiProperty({ type: [DisclosureFieldDto] })
  readonly fields: DisclosureFieldDto[];

  constructor(step: DisclosureStep) {
    this.module = step.module;
    this.taxonomyVersion = step.taxonomyVersion;
    this.fields = step.fields.map((field) => new DisclosureFieldDto(field));
  }
}

/** One field's new contents, addressed by the natural key §7.3 gives a value. */
export class DisclosureValueWriteDto {
  @ApiProperty({ example: 'NumberOfEmployees' })
  @IsString()
  @MaxLength(255)
  elementKey!: string;

  @ApiPropertyOptional({ description: 'An axis member; omit for an undimensioned element.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dimensionKey?: string;

  @ApiPropertyOptional({ description: 'Position within a repeating group.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordinal?: number;

  @ApiPropertyOptional({ type: String, description: 'Decimal as a string, never a float (NFR-58).' })
  @IsOptional()
  @IsString()
  valueNumeric?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  valueText?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean | null;

  @ApiPropertyOptional({ type: String, example: '2026-12-31' })
  @IsOptional()
  @IsISO8601({ strict: true })
  valueDate?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  unitCode?: string | null;

  @ApiProperty({ enum: STATES })
  @IsIn(STATES)
  state!: DisclosureState;

  @ApiPropertyOptional({
    type: String,
    description: 'Required exactly when the state is not available (FR-32) — enforced by the store.',
  })
  @IsOptional()
  @IsString()
  notAvailableReason?: string | null;

  @ApiPropertyOptional({ description: 'FR-47: this value was carried forward from the prior period.' })
  @IsOptional()
  @IsBoolean()
  carriedForward?: boolean;
}

export class WriteDisclosureValuesRequestDto {
  @ApiProperty({
    type: [DisclosureValueWriteDto],
    description:
      'One field on blur, or everything a step change or an offline queue accumulated (FR-37, ' +
      'FR-38). The write is an upsert on the natural key, so a retried queue does not double-write.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_VALUES_PER_WRITE)
  @ValidateNested({ each: true })
  @Type(() => DisclosureValueWriteDto)
  values!: DisclosureValueWriteDto[];
}

/** What was durably committed — UX-36 acknowledges the commit, never optimistic local state. */
export class DisclosureValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty()
  readonly elementKey: string;

  @ApiProperty()
  readonly dimensionKey: string;

  @ApiProperty()
  readonly ordinal: number;

  @ApiProperty({ nullable: true, type: String })
  readonly valueNumeric: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueText: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  readonly valueBoolean: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  readonly valueDate: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly unitCode: string | null;

  @ApiProperty({ enum: STATES })
  readonly state: DisclosureState;

  @ApiProperty({ nullable: true, type: String })
  readonly notAvailableReason: string | null;

  @ApiProperty()
  readonly carriedForward: boolean;

  @ApiProperty({ description: 'Unix epoch milliseconds, UTC.' })
  readonly updatedAt: number;

  constructor(value: DisclosureValue) {
    this.id = value.id;
    this.elementKey = value.elementKey;
    this.dimensionKey = value.dimensionKey;
    this.ordinal = value.ordinal;
    this.valueNumeric = value.valueNumeric;
    this.valueText = value.valueText;
    this.valueBoolean = value.valueBoolean;
    this.valueDate = value.valueDate;
    this.unitCode = value.unitCode;
    this.state = value.state;
    this.notAvailableReason = value.notAvailableReason;
    this.carriedForward = value.carriedForward;
    this.updatedAt = value.updatedAt;
  }
}
