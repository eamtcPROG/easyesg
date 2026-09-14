import { ApiProperty } from '@nestjs/swagger';
import type { AdminEnrolmentOffer } from '../use-cases/stage-admin-enrolment.use-case';

/**
 * The second factor staged for an invitation (task 67.4; A-20) — the secret and the Key Uri its QR
 * symbol encodes. Returned only to the bearer of a live link, which is the capability that stages it.
 */
export class AdminEnrolmentResponseDto {
  @ApiProperty({
    description: 'The base32 secret, for typing into an authenticator that cannot scan.',
    example: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  })
  readonly secret: string;

  @ApiProperty({
    description: 'The otpauth Key Uri the enrolment symbol encodes — the same secret, scannable.',
  })
  readonly uri: string;

  constructor(offer: AdminEnrolmentOffer) {
    this.secret = offer.secret;
    this.uri = offer.uri;
  }
}
