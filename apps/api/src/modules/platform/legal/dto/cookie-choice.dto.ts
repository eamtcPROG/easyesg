import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { EpochMillis } from '@api/contracts/types/time';
import type { RecordedCookieChoice } from '../models/cookie-choice.model';

/**
 * The cookie banner's wire objects (task 223; §12.5.6's task-223 row (2), (6)). One file because they are one
 * vocabulary.
 *
 * **Bounded, not judged**, task 195's rule: whether the version is the one in force is the use case's to say —
 * answered `legal-version-changed` — so here it is only a short string, as the column's `CHECK` bounds it.
 */
const VERSION_BOUNDS = { minLength: 1, maxLength: 32 } as const;

/** `POST /legal/cookie-choices` — *I understand* on the banner, or *Save* in its settings. */
export class RecordCookieChoiceRequestDto {
  @ApiProperty({
    ...VERSION_BOUNDS,
    example: '1.0',
    description:
      'The version of the cookie policy the banner was shown under. Refused unless it is the version in force — a ' +
      'banner read before a release replaced the policy is shown again rather than recorded.',
  })
  @IsString()
  @MinLength(VERSION_BOUNDS.minLength)
  @MaxLength(VERSION_BOUNDS.maxLength)
  policyVersion!: string;
}

/** The answer as recorded — what the browser's cookie carries. */
export class CookieChoiceResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The record’s id, which the browser keeps in its cookie.' })
  readonly id: string;

  @ApiProperty({ example: '1.0', description: 'The cookie policy version answered.' })
  readonly policyVersion: string;

  @ApiProperty({ type: 'integer', description: 'Unix epoch milliseconds, UTC.', example: 1_792_742_400_000 })
  readonly chosenAt: EpochMillis;

  constructor(choice: RecordedCookieChoice) {
    this.id = choice.id;
    this.policyVersion = choice.policyVersion;
    this.chosenAt = choice.chosenAt.getTime();
  }
}
