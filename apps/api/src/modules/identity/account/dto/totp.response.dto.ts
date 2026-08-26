import { ApiProperty } from '@nestjs/swagger';
import type { TotpState } from '../models/totp.model';
import type { TotpEnrolmentOffer } from '../use-cases/manage-totp.use-case';
import { formatRecoveryCode } from '../domain/recovery-code';

/** `GET /api/v1/account/totp` — what S-28 reads. Never the secret, never the codes. */
export class TotpStateResponseDto {
  @ApiProperty({ description: 'Whether a confirmed second factor is in force on this account.' })
  enrolled: boolean;

  @ApiProperty({
    description:
      'Unspent recovery codes. Zero with an enrolled factor is a real state, not an error — the ' +
      'user has spent them all and should re-issue before they need one.',
  })
  recoveryCodesRemaining: number;

  constructor(state: TotpState) {
    this.enrolled = state.enrolled;
    this.recoveryCodesRemaining = state.recoveryCodesRemaining;
  }
}

/**
 * `POST /api/v1/account/totp/enrolment` — the only response that ever carries the secret.
 *
 * It is not stored anywhere the client can read it back: a second `GET` returns state, not this.
 * A user who loses the screen mid-enrolment starts again, which costs one password and no risk.
 */
export class TotpEnrolmentResponseDto {
  @ApiProperty({
    description:
      'The base32 secret, for an authenticator that is being configured by hand rather than by ' +
      'scanning. Shown once and never returned again.',
  })
  secret: string;

  @ApiProperty({
    description:
      'The same secret in the Key Uri Format an authenticator’s QR scanner consumes, emitted by ' +
      'the same object that verifies the code, so a client cannot configure parameters the ' +
      'server will not accept.',
    example: 'otpauth://totp/EasyESG:ana@example.md?secret=...&issuer=EasyESG',
  })
  enrolmentUri: string;

  constructor(offer: TotpEnrolmentOffer) {
    this.secret = offer.secret;
    this.enrolmentUri = offer.enrolmentUri;
  }
}

/**
 * The recovery codes, returned by confirmation and by re-issue — the only two moments they exist
 * outside the user's own keeping (UC-193, UC-195).
 *
 * Grouped for transcription here rather than in the client, so every surface that shows them
 * groups them identically and the server's normalisation is guaranteed to accept what it printed.
 */
export class RecoveryCodesResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'Single-use codes, shown exactly once. Re-issuing replaces the whole set, so any code from ' +
      'a previous set stops working the moment a new one is issued.',
    example: ['0123-4567-89AB-CDEF'],
  })
  recoveryCodes: string[];

  constructor(codes: readonly string[]) {
    this.recoveryCodes = codes.map(formatRecoveryCode);
  }
}
