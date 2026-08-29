import type { NaceCodeMatch } from '../models/reporting-entity.model';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';
import {
  CONSOLIDATION_BASIS,
  ENTITY_STATUS,
  type ConsolidationBasis,
  type ConsolidationMember,
  type ReportingEntity,
  type Site,
} from '../models/reporting-entity.model';

/** Decimal degrees as a decimal string — never a float, for the column's own reason (NFR-58). */
const DECIMAL_DEGREES = /^-?\d{1,3}(\.\d{1,6})?$/u;

/** CAEM Rev.2 / NACE Rev.2: a section letter, or a division, group or class. */
const NACE_SHAPE = /^([A-U]|\d{2}(\.\d{1,2})?)$/u;

export class SiteRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Omit to add a site; supply an existing id to edit that one. A site the array omits is ' +
      'removed, which is what makes this collection a save rather than an append.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 200)
  addressLine1?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 120)
  locality?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 20 })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 20)
  postalCode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'MD' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Za-z]{2}$/u)
  countryCode?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '47.024512',
    description:
      'Decimal degrees as a string, not a number. B5’s biodiversity applicability is evaluated ' +
      'from these coordinates (BR-APP-3), so a value that drifts in the last places is a ' +
      'determination that changes — which is why neither the column nor the wire uses a float.',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL_DEGREES)
  latitude?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '28.832363' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL_DEGREES)
  longitude?: string | null;
}

export class ConsolidationMemberRequestDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to add; supply an id to edit that member.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 200, description: 'The subsidiary’s legal name, as B1 publishes it.' })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1003600158022' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[0-9]{13}$/u)
  idno?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7LTWFZYICNSX8D621K86' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Z0-9]{18}[0-9]{2}$/u)
  lei?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'MD' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Za-z]{2}$/u)
  countryCode?: string | null;
}

/** Shared by create and edit — UC-52 and UC-53 take the same fields. */
class ReportingEntityFieldsDto {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'A key from the country’s legal-form vocabulary.' })
  @Trim()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 40)
  legalForm?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['10.71', '56.10'],
    description:
      'CAEM Rev.2 codes — 1:1 with NACE Rev.2 to four characters, which is what B1 exports. Each ' +
      'is admitted against the classifier registered for the organization’s country; an empty ' +
      'array means the entity is not classified yet, which FR-17 permits.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(NACE_SHAPE, { each: true })
  naceCodes?: string[];

  @ApiPropertyOptional({
    type: [SiteRequestDto],
    description:
      'The entity’s sites, as a whole collection. Omit to leave them alone; send an array to save ' +
      'them — members with an id are edited, members without are added, and stored sites the ' +
      'array omits are removed.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SiteRequestDto)
  sites?: SiteRequestDto[];

  @ApiPropertyOptional({
    enum: Object.values(CONSOLIDATION_BASIS),
    nullable: true,
    description:
      'FR-19’s reporting boundary, which bounds every quantitative figure in the report and which ' +
      'B1 discloses. Null until stated — VSME asks the question explicitly, so there is no default ' +
      'answering it on the undertaking’s behalf. Setting `consolidated` requires at least one ' +
      'subsidiary inside the boundary.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(Object.values(CONSOLIDATION_BASIS))
  consolidationBasis?: ConsolidationBasis | null;

  @ApiPropertyOptional({
    type: [ConsolidationMemberRequestDto],
    description:
      'The subsidiaries inside the boundary, as a whole collection — the same save semantics as ' +
      '`sites`. Recorded whatever the basis says: switching to `individual` leaves the list ' +
      'standing, and B1 reads it only when the basis is `consolidated`.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ConsolidationMemberRequestDto)
  consolidationMembers?: ConsolidationMemberRequestDto[];
}

export class CreateReportingEntityRequestDto extends ReportingEntityFieldsDto {
  @ApiProperty({ maxLength: 200, description: 'The entity’s name, as it is reported on.' })
  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;
}

export class UpdateReportingEntityRequestDto extends ReportingEntityFieldsDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}

export class ConsolidationMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) idno: string | null;
  @ApiProperty({ type: String, nullable: true }) lei: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode: string | null;

  constructor(member: ConsolidationMember) {
    this.id = member.id;
    this.name = member.name;
    this.idno = member.idno;
    this.lei = member.lei;
    this.countryCode = member.countryCode;
  }
}

export class SiteResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) addressLine1: string | null;
  @ApiProperty({ type: String, nullable: true }) locality: string | null;
  @ApiProperty({ type: String, nullable: true }) postalCode: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal degrees as a string (NFR-58).' })
  latitude: string | null;
  @ApiProperty({ type: String, nullable: true }) longitude: string | null;

  constructor(site: Site) {
    this.id = site.id;
    this.name = site.name;
    this.addressLine1 = site.addressLine1;
    this.locality = site.locality;
    this.postalCode = site.postalCode;
    this.countryCode = site.countryCode;
    this.latitude = site.latitude;
    this.longitude = site.longitude;
  }
}

export class ReportingEntityResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) legalForm: string | null;
  @ApiProperty({ type: [String] }) naceCodes: string[];

  @ApiProperty({
    enum: Object.values(ENTITY_STATUS),
    description:
      'Archived entities leave active selection and keep their reports and exports (FR-20). They ' +
      'remain readable here; their master data is read-only.',
  })
  status: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Unix epoch milliseconds, or null while active.' })
  archivedAt: number | null;

  @ApiProperty({
    enum: Object.values(CONSOLIDATION_BASIS),
    nullable: true,
    description: 'Null until stated. B1 discloses it and task 38’s calculator aggregates over it.',
  })
  consolidationBasis: string | null;

  @ApiProperty({
    type: [ConsolidationMemberResponseDto],
    description: 'The boundary’s subsidiaries. Meaningful when the basis is `consolidated`; kept regardless.',
  })
  consolidationMembers: ConsolidationMemberResponseDto[];

  @ApiProperty({ type: [SiteResponseDto] }) sites: SiteResponseDto[];
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds.' }) createdAt: number;
  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds.' }) updatedAt: number;

  constructor(entity: ReportingEntity) {
    this.id = entity.id;
    this.name = entity.name;
    this.legalForm = entity.legalForm;
    this.naceCodes = [...entity.naceCodes];
    this.status = entity.status;
    this.archivedAt = entity.archivedAt?.getTime() ?? null;
    this.consolidationBasis = entity.consolidationBasis;
    this.consolidationMembers = entity.consolidationMembers.map(
      (member) => new ConsolidationMemberResponseDto(member),
    );
    this.sites = entity.sites.map((site) => new SiteResponseDto(site));
    this.createdAt = entity.createdAt.getTime();
    this.updatedAt = entity.updatedAt.getTime();
  }
}

/**
 * One activity code the picker offers (FR-17, task 30.4.1).
 *
 * **Both members, and the code is not decoration.** The label is what the reader recognises and the
 * code is what B1 exports, so the picker shows the pair and stores the key — a screen that showed
 * only the label would leave nobody able to check the code that reaches the report, and one that
 * showed only the code would ask an SME owner to know a classifier they have never opened.
 */
export class NaceCodeResponseDto {
  @ApiProperty({
    example: '10.71',
    description:
      'CAEM Rev.2, 1:1 with NACE Rev.2 to four characters. Sections are one character, divisions ' +
      'two, groups four and classes five including the dot.',
  })
  code: string;

  @ApiProperty({
    example: 'Fabricarea pâinii; fabricarea prăjiturilor',
    description:
      'The activity’s name in the request’s negotiated language, falling back to a language the ' +
      'classifier does carry rather than hiding the entry.',
  })
  label: string;

  constructor(match: NaceCodeMatch) {
    this.code = match.code;
    this.label = match.label;
  }
}
