import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { EpochMillis } from '@api/contracts/types/time';
import type { CalcSource } from '../models/calc-source.model';

/** The longest free text a line carries — a sentence for a reader of the report, not an essay. */
const MAX_LINE_TEXT = 500;

const QUANTITY =
  'The figure on the invoice, as a decimal string — `500`, `1700.5` — in `unitCode`. Omit it, and the unit, ' +
  'where `notAvailableReason` says why there is none.';

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
    this.updatedAt = source.updatedAt.getTime();
  }
}
