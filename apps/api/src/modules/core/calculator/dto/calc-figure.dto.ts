import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The longest reason a figure carries — a sentence or two for a third party to read beside both figures (UX-43). */
const MAX_EXPLANATION = 500;

/** UC-34's *replace* for a B3 figure (task 38.4): the reporter's tonnes, and why. */
export class OverrideFigureRequestDto {
  @ApiProperty({ example: '1.75', description: 'Tonnes of CO₂e in place of the computed figure, as a decimal string.' })
  @IsString()
  @MaxLength(64)
  valueNumeric!: string;

  @ApiProperty({
    example: 'Our accountant’s figure, from metered readings.',
    description: 'Why it replaces the computed figure. Required, and printed beside both (UX-43).',
  })
  @IsString()
  @MaxLength(MAX_EXPLANATION)
  explanation!: string;
}

/** UC-34's *explain* for a B3 figure (task 38.4): a note, or `null` to remove it. */
export class ExplainFigureRequestDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'The Cahul shop is billed by its landlord and is not included.',
    description: 'A note that stays beside the computed figure. Omit, send null or send blank to remove it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXPLANATION)
  explanation?: string | null;
}
