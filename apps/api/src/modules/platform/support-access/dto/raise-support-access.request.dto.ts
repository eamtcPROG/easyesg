import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/**
 * A-07's request (task 67.9; UC-85, FR-78). **The ticket and the reason are both required**: access for support
 * exists only against a ticket, and the organization reads the reason before it answers.
 *
 * **The lengths are cost bounds, not rules about support**: a ticket reference is an identifier from another
 * system, and a reason is a sentence or two a person will read in a banner.
 */
export class RaiseSupportAccessRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The organization whose report data the request asks to read.',
  })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({
    maxLength: 64,
    example: 'SUP-4417',
    description: 'The support ticket the request acts on.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ticketReference!: string;

  @ApiProperty({
    maxLength: 500,
    example: 'The owner reports the Scope 2 figure is missing from the export after recalculation.',
    description: 'Why access is needed, written for the organization, which reads it before answering.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
