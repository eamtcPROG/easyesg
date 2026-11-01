import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';

/**
 * `POST /api/v1/account/setup/profile` (task 155; S-36's second step). Both name parts required and
 * bounded as registration bounds them (`RegisterAccountRequestDto` records why a length is a shape and
 * belongs here); a part that is only whitespace passes these and is refused by the use case.
 */
export class SaveSetupProfileRequestDto {
  @ApiProperty({ example: 'Ana', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  givenName!: string;

  @ApiProperty({ example: 'Popescu', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  familyName!: string;

  @ApiProperty({
    enum: [...LOCALES],
    description: 'The interface language to persist on the account (FR-10).',
  })
  @IsIn([...LOCALES])
  locale!: Locale;
}
