import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { COMPATIBILITY, FIELD_CHANGE, type Compatibility, type FieldChange, type VersionMapping } from '../domain/version-mapping';
import {
  LABEL_CHANGE,
  type AdoptionWindow,
  type LabelChange,
  type LabelDiff,
  type RegisteredVersion,
  type StoredMapping,
  type TaxonomyConsole,
  type TaxonomyExposure,
} from '../models/taxonomy-console.model';

/**
 * A-04's wire (tasks 67.21, 67.22, 67.6; §12.5.6's task-67.21 row) — one vocabulary of objects, kept whole. A version is
 * EFRAG's own `YYYY-MM-DD` (OQ-45); a template release EFRAG's `1.3.0`. Counts only, never a report's value (D-5).
 */
const VERSION = /^\d{4}-\d{2}-\d{2}$/u;
/** The version the examples name — the one this release adopts from 2026 (OQ-45's spelling). */
const EXAMPLE_VERSION = '2026-05-01';

export class RegisteredVersionResponseDto {
  @ApiProperty({ example: EXAMPLE_VERSION }) readonly version!: string;
  @ApiProperty({ type: [String], example: ['1.3.0'] }) readonly templateVersions!: readonly string[];
}

export class AdoptionWindowResponseDto {
  @ApiProperty({ type: String, nullable: true, description: 'Inclusive; null for a window open to the past.' })
  readonly validFrom!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Exclusive; null for the open window.' })
  readonly validTo!: string | null;
  @ApiProperty({ example: EXAMPLE_VERSION }) readonly version!: string;
  @ApiProperty({ example: '1.3.0' }) readonly templateVersion!: string;
  @ApiProperty({ description: 'The revision a change to the open window is made against.' }) readonly revision!: number;
}

export class MappedFieldDto {
  @ApiProperty({ example: 'TotalEnergyConsumption' })
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/u)
  element!: string;

  @ApiProperty({ enum: Object.values(FIELD_CHANGE) })
  @IsIn(Object.values(FIELD_CHANGE))
  change!: FieldChange;
}

export class VersionMappingResponseDto {
  @ApiProperty({ example: '2026-02-01' }) readonly from!: string;
  @ApiProperty({ example: EXAMPLE_VERSION }) readonly to!: string;
  @ApiProperty({ enum: Object.values(COMPATIBILITY) }) readonly determination!: Compatibility;
  @ApiProperty({ type: [MappedFieldDto] }) readonly fields!: readonly MappedFieldDto[];
}

export class StoredMappingResponseDto extends VersionMappingResponseDto {
  @ApiProperty({ description: 'The revision a change to the mapping is made against.' }) readonly revision!: number;
}

export class TaxonomyConsoleResponseDto {
  @ApiProperty({ type: [RegisteredVersionResponseDto] }) readonly versions: readonly RegisteredVersion[];
  @ApiProperty({ type: [String], description: 'Versions the release commits and nobody has registered yet.' })
  readonly candidates: readonly string[];
  @ApiProperty({ type: [AdoptionWindowResponseDto], description: 'Which version a period opened on a day pins.' })
  readonly adoption: readonly AdoptionWindow[];
  @ApiProperty({ type: [StoredMappingResponseDto] }) readonly mappings: readonly StoredMapping[];

  constructor(view: TaxonomyConsole) {
    this.versions = view.versions;
    this.candidates = view.candidates;
    this.adoption = view.adoption;
    this.mappings = view.mappings;
  }
}

export class RegisterTaxonomyVersionRequestDto {
  @ApiProperty({ example: '2026-11-01', description: 'A committed candidate’s version.' })
  @Matches(VERSION)
  version!: string;
}

export class PublishVersionMappingRequestDto {
  @ApiProperty({ enum: Object.values(COMPATIBILITY) })
  @IsIn(Object.values(COMPATIBILITY))
  determination!: Compatibility;

  @ApiProperty({ type: [MappedFieldDto], maxItems: 1000, description: 'Each field added, removed or altered — nothing more.' })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MappedFieldDto)
  fields!: MappedFieldDto[];

  @ApiProperty({ minimum: 0, description: 'The mapping’s revision as read — 0 where the pair had none.' })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class AdoptTaxonomyVersionRequestDto {
  @ApiProperty({ example: EXAMPLE_VERSION }) @Matches(VERSION) version!: string;
  @ApiProperty({ example: '1.3.0' }) @Matches(/^\d+\.\d+\.\d+$/u) templateVersion!: string;
  @ApiProperty({ example: '2027-01-01', description: 'Periods starting on or after this day pin the version.' })
  @Matches(VERSION)
  from!: string;
  @ApiProperty({ minimum: 0, description: 'The open window’s revision as read.' }) @IsInt() @Min(0) expectedRevision!: number;
}

export class PublishedTaxonomyResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The publication, or the version put in force.' }) readonly id: string;

  constructor(published: { readonly id: string }) {
    this.id = published.id;
  }
}

export class ExposureVersionResponseDto {
  @ApiProperty() readonly version!: string;
  @ApiProperty() readonly reports!: number;
  @ApiProperty() readonly organizations!: number;
}

export class ExposureOrganizationVersionResponseDto {
  @ApiProperty() readonly version!: string;
  @ApiProperty() readonly reports!: number;
}

export class ExposureOrganizationResponseDto {
  @ApiProperty({ format: 'uuid' }) readonly organizationId!: string;
  @ApiProperty() readonly name!: string;
  @ApiProperty({ type: [ExposureOrganizationVersionResponseDto] })
  readonly versions!: readonly ExposureOrganizationVersionResponseDto[];
}

export class TaxonomyExposureResponseDto {
  @ApiProperty({ type: String, nullable: true, description: 'The newest registered version — what “superseded” is read against.' })
  readonly newest: string | null;
  @ApiProperty({ type: [ExposureVersionResponseDto] }) readonly versions: readonly ExposureVersionResponseDto[];
  @ApiProperty({ type: [ExposureOrganizationResponseDto] }) readonly organizations: readonly ExposureOrganizationResponseDto[];

  constructor(exposure: TaxonomyExposure) {
    this.newest = exposure.newest;
    this.versions = exposure.versions;
    this.organizations = exposure.organizations;
  }
}

export class LabelDiffEntryResponseDto {
  @ApiProperty() readonly element!: string;
  @ApiProperty({ enum: Object.values(LABEL_CHANGE) }) readonly change!: LabelChange;
  @ApiProperty({ type: String, nullable: true }) readonly before!: string | null;
  @ApiProperty({ type: String, nullable: true }) readonly after!: string | null;
}

export class LabelDiffResponseDto {
  @ApiProperty() readonly from: string;
  @ApiProperty() readonly to: string;
  @ApiProperty({ enum: LOCALES }) readonly locale: Locale;
  @ApiProperty({ description: 'Whether EFRAG publishes this locale’s labels for both versions.' }) readonly official: boolean;
  @ApiProperty({ type: [LabelDiffEntryResponseDto] }) readonly entries: readonly LabelDiffEntryResponseDto[];

  constructor(diff: LabelDiff) {
    this.from = diff.from;
    this.to = diff.to;
    this.locale = diff.locale;
    this.official = diff.official;
    this.entries = diff.entries;
  }
}

/** The pair from a mapping route's path and the body's mapping, as the use case takes one. */
export const mappingOf = (input: {
  readonly from: string;
  readonly to: string;
  readonly body: PublishVersionMappingRequestDto;
}): VersionMapping => ({
  from: input.from,
  to: input.to,
  determination: input.body.determination,
  fields: input.body.fields.map((field) => ({ element: field.element, change: field.change })),
});
