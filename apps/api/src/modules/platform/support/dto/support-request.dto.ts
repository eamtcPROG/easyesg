import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { Trim } from '@api/app/decorators/trim.decorator';
import { SUPPORT_NAME_MAX_LENGTH, SUPPORT_QUESTION_MAX_LENGTH } from '../constants/support.constants';
import { SUPPORT_TOPIC, type SupportTopic } from '../models/support-request.model';

/**
 * S-34's request (task 77; UC-182, FR-212; `architecture.md` §12.5.6's task-77 row (3)). **A visitor's name and
 * address are optional on the wire and required of a visitor**: whether a session came is the guard's to know, so the
 * use case refuses a visitor who gave neither, and a signed-in reader's are ignored — the account's travel instead.
 * The lengths are cost bounds the table's `CHECK`s share, not rules about support.
 */
export class SubmitSupportRequestDto {
  @ApiProperty({
    enum: Object.values(SUPPORT_TOPIC),
    description: 'What the question is about — it decides only who at support reads it first.',
  })
  @IsIn(Object.values(SUPPORT_TOPIC))
  topic!: SupportTopic;

  @ApiProperty({ maxLength: SUPPORT_QUESTION_MAX_LENGTH, description: 'The question, in the reader’s own words.' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(SUPPORT_QUESTION_MAX_LENGTH)
  question!: string;

  @ApiProperty({ enum: LOCALES, description: 'The language support replies in.' })
  @IsIn(LOCALES)
  replyLocale!: Locale;

  @ApiPropertyOptional({
    maxLength: SUPPORT_NAME_MAX_LENGTH,
    description: 'A visitor’s name — required with no session; ignored with one, when the account’s travels instead.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(SUPPORT_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    format: 'email',
    maxLength: 320,
    description: 'Where a visitor wants the reply — required with no session; ignored with one.',
  })
  @IsOptional()
  @Trim()
  @IsEmail()
  @MaxLength(320)
  email?: string;
}

/** What a reader is shown once a request is sent: the reference they quote. */
export class SupportRequestReceiptDto {
  @ApiProperty({
    example: 'SR-000042',
    description: 'The request’s reference — `SR-` and six digits — which support’s reply carries.',
  })
  readonly reference: string;

  constructor(receipt: { readonly reference: string }) {
    this.reference = receipt.reference;
  }
}
