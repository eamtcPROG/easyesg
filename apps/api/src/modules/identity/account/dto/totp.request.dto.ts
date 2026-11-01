import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { TOTP_DIGITS } from '@api/modules/platform/admin/domain/totp';

/**
 * The second factor's request bodies (NFR-95, UC-193; task 27.2).
 *
 * **The password is optional in the TYPE and mandatory in the RULE**, which looks like a hole and
 * is not: FR-2's provider-only account holds no credential row and has no password to send, so
 * §12.5.6's task-27.2 row lets the session stand as its credential. The use case decides which
 * case it is from the ABSENCE of a credential rather than from the presence of this field, so an
 * account that has a password cannot skip re-authentication by omitting it. Making the field
 * required here would instead lock every provider-only user out of their own settings screen.
 */
export class TotpReauthenticationRequestDto {
  @ApiPropertyOptional({
    format: 'password',
    description:
      'The account’s current password. Required for every account that has one; omitted only by ' +
      'an account that signs in through a provider and holds no password.',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

/** `POST /api/v1/account/totp/confirmation` — the code that proves the authenticator captured it. */
export class ConfirmTotpRequestDto {
  @ApiProperty({
    description:
      'The current code shown by the authenticator app, which is what proves the secret was ' +
      'captured. Enrolment activates on this and not before.',
    example: '123456',
  })
  @IsString()
  // Shape only. Whether the code is CURRENT is the use case's question, and it is deliberately not
  // asked here: a validation refusal and a wrong-code refusal are different problem types, and the
  // reader must not be able to tell a malformed code from an expired one by which one they get.
  @Matches(new RegExp(`^\\d{${TOTP_DIGITS}}$`, 'u'), {
    message: 'identity.totp.code_shape',
  })
  code!: string;
}
