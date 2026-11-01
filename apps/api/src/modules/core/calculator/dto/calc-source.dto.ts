import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { EpochMillis } from '@api/contracts/types/time';
import { OverridingPersonDto } from '@api/modules/core/disclosure/dto/overriding-person.dto';
import type { CalcSource } from '../models/calc-source.model';

/** The longest free text a line carries — a sentence for a reader of the report, not an essay. */
const MAX_LINE_TEXT = 500;

const QUANTITY =
  'The figure on the invoice, as a decimal string — `500`, `1700.5` — in `unitCode`. Omit it, and the unit, ' +
  'where `notAvailableReason` says why there is none, and omit it where `monthlyQuantities` carries the figure.';

const MONTHS =
  'The monthly form (task 39.1): twelve figures in `unitCode`, by position from the period’s start month, each a ' +
  'decimal string or null for a month left empty, at least one entered. The line’s quantity is their sum, computed ' +
  'by the server. Only where the period spans twelve calendar months (the calculator read’s `months`); sent without ' +
  '`quantity` or `notAvailableReason`. Omit it, or send null, for one figure for the period.';

/** The monthly form's rows on the wire — the twelve the form has, never more (`domain/period-months.ts`). */
const MONTH_ROWS = 12;

/**
 * One invoice line, as a client writes it (task 38.1; UC-32, FR-33).
 *
 * **A figure with its unit, or a reason with neither.** Each is optional here so either shape can be sent; which one
 * was sent is the use case's to check, against the same rule the table's CHECK holds — so a malformed line is a
 * `400` with a message rather than a constraint error.
 */
export class WriteCalcSourceRequestDto {
  @ApiProperty({ minimum: 0, example: 0, description: "The report's B1 site row the line belongs to." })
  @IsInt()
  @Min(0)
  siteOrdinal!: number;

  @ApiProperty({
    example: 'natural_gas',
    description: "A source of the factor set the report's period resolves; its name is a catalogue key.",
  })
  @IsString()
  @MaxLength(64)
  sourceKey!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Oven and boiler', description: 'The reporter’s own name.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LINE_TEXT)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '500', description: QUANTITY })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  quantity?: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', nullable: true },
    nullable: true,
    minItems: MONTH_ROWS,
    maxItems: MONTH_ROWS,
    example: ['40', '45', null, '38', '30', '22', '18', '17', '21', '33', '41', '48'],
    description: MONTHS,
  })
  // The shape — twelve, each a decimal or empty — is the use case's to refuse with its own message
  // (`domain/calc-source-check.ts`'s `monthsRefusal`), as the line's contents are; here only that it is a bounded list.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MONTH_ROWS)
  monthlyQuantities?: (string | null)[] | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'm3', description: "One of the source's units." })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unitCode?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Billed by the landlord',
    description: 'Why there is no figure. Sent instead of a quantity and its unit, never with them.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LINE_TEXT)
  notAvailableReason?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '0.84',
    description:
      'The reporter’s own tonnes of CO₂e in place of the computed figure (UC-34), as a decimal string — sent with ' +
      '`overrideExplanation`, and only on a line with a quantity. Omit both to let the computed figure stand.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  overrideTonnes?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'One van on the fleet card was sub-leased from March.',
    description: 'Why the computed figure is replaced. Required with `overrideTonnes` (UX-43), never without it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LINE_TEXT)
  overrideExplanation?: string | null;
}

/** One invoice line, as the report holds it. */
export class CalcSourceDto {
  @ApiProperty({ format: 'uuid', description: 'The id its client chose.' })
  readonly id: string;

  @ApiProperty({ minimum: 0 })
  readonly siteOrdinal: number;

  @ApiProperty({ example: 'natural_gas' })
  readonly sourceKey: string;

  @ApiProperty({ type: String, nullable: true })
  readonly description: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'A decimal string, never a number.' })
  readonly quantity: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly unitCode: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly notAvailableReason: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', nullable: true },
    nullable: true,
    description:
      'The twelve month figures `quantity` sums, by position from the period’s start month, null for a month left ' +
      'empty — or null for a line entered as one figure (task 39.1).',
  })
  readonly monthlyQuantities: (string | null)[] | null;

  @ApiProperty({ type: String, nullable: true, description: 'The reporter’s tonnes in place of the computed ones.' })
  readonly overrideTonnes: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Why they replace them.' })
  readonly overrideExplanation: string | null;

  @ApiProperty({
    type: OverridingPersonDto,
    nullable: true,
    description: 'Who replaced the line’s tonnes (FR-36); null where the computed figure stands.',
  })
  readonly overriddenBy: OverridingPersonDto | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds, UTC.' })
  readonly updatedAt: EpochMillis;

  constructor(source: CalcSource) {
    this.id = source.sourceId;
    this.siteOrdinal = source.siteOrdinal;
    this.sourceKey = source.sourceKey;
    this.description = source.description;
    this.quantity = source.contents.quantity;
    this.unitCode = source.contents.unitCode;
    this.notAvailableReason = source.contents.notAvailableReason;
    this.monthlyQuantities = source.monthlyQuantities === null ? null : [...source.monthlyQuantities];
    this.overrideTonnes = source.override?.tonnesCo2e ?? null;
    this.overrideExplanation = source.override?.explanation ?? null;
    this.overriddenBy = source.overriddenBy === null ? null : new OverridingPersonDto(source.overriddenBy);
    this.updatedAt = source.updatedAt.getTime();
  }
}
