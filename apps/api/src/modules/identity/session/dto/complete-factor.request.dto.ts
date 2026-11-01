import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/session/factor` (UC-194, UC-195; task 27.3).
 *
 * **One `code` field for both kinds of answer, and no mode flag.** A TOTP code is six digits and a
 * recovery code is sixteen base32 characters, so the value already states which it is; a `kind`
 * parameter would be a second source of truth about that, and a client that got it wrong would
 * receive a refusal for a correct code. S-01 still offers two affordances — that is presentation.
 *
 * Neither field is shape-validated beyond being a string, deliberately. A malformed code and a
 * wrong code must produce the same refusal, or the difference between them becomes an oracle: a
 * `400` for six letters and a `403` for six wrong digits tells a prober exactly what shape to
 * send. `ConfirmTotpRequestDto` takes the opposite view because there the caller is authenticated
 * and enrolling, and nothing is being guessed.
 */
export class CompleteFactorRequestDto {
  @ApiProperty({
    description:
      'The opaque challenge returned by the first step. Sealed; the API is the only thing that ' +
      'can read it.',
  })
  @IsString()
  challenge!: string;

  @ApiProperty({
    description:
      'A current code from the authenticator, or one of the account’s recovery codes. The two ' +
      'are distinguishable by shape, so one field serves both.',
    example: '123456',
  })
  @IsString()
  code!: string;
}
