import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

/**
 * Cost bounds, not policy: a registered name, an address and an email address well past anything the register or a
 * mailbox holds. **What makes a value admissible is not here** — a blank field, an IDNO whose check digit is wrong,
 * an address that is not one are the use case's refusals, by the function the store's publication rule reads, so the
 * console and the seed cannot be held to different rules.
 */
const NAME_MAX = 300;
const IDNO_MAX = 32;
const ADDRESS_MAX = 500;
const EMAIL_MAX = 254;

/** A-21's save (task 75; FR-205): the four facts the legal documents state about the platform operator. */
export class PublishLegalControllerRequestDto {
  @ApiProperty({ maxLength: NAME_MAX, example: 'EasyESG SRL', description: 'The operator’s name as registered.' })
  @IsString()
  @MaxLength(NAME_MAX)
  registeredName!: string;

  @ApiProperty({
    maxLength: IDNO_MAX,
    example: '1099600012345',
    description: 'The operator’s IDNO — 13 digits, the last a check digit, judged as a reporting entity’s is.',
  })
  @IsString()
  @MaxLength(IDNO_MAX)
  idno!: string;

  @ApiProperty({ maxLength: ADDRESS_MAX, description: 'The operator’s registered address, as registered.' })
  @IsString()
  @MaxLength(ADDRESS_MAX)
  registeredAddress!: string;

  @ApiProperty({ maxLength: EMAIL_MAX, description: 'Where questions about personal data are sent.' })
  @IsString()
  @MaxLength(EMAIL_MAX)
  dataProtectionEmail!: string;

  @ApiProperty({
    type: Number,
    minimum: 0,
    description:
      'The revision this change was made against — the one the reading answered. A newer one in force refuses ' +
      'the change (problem type legal-controller-changed).',
  })
  @IsInt()
  @Min(0)
  revision!: number;
}
