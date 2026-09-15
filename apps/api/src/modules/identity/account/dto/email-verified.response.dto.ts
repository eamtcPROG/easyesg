import { ApiProperty } from '@nestjs/swagger';
import type { EmailVerified } from '../use-cases/verify-email.use-case';
import { AccountResponseDto } from './account.response.dto';

/**
 * `POST /api/v1/auth/verify-email`'s answer — the account, and since task 155 the grant a consumed
 * link hands an account holding no password, with its expiry.
 *
 * **The grant travels in the body, like the factor challenge**, because the api is a back channel and
 * the web tier holds it for the one request that follows. It is single-use and lasts a quarter-hour,
 * so returning it to the caller who has just proved the mailbox concedes nothing that caller lacks.
 * **The expiry travels with it** so the web tier's sealed cookie takes the api's instant rather than
 * restating the quarter-hour.
 */
export class EmailVerifiedResponseDto extends AccountResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'For an account that holds no password — registered through a provider that did not confirm the ' +
      'address — a single-use grant that sets its first password within 15 minutes and signs it in. ' +
      'Null for every other account, which is active and signs in as before.',
  })
  readonly setupGrant: string | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'When the setup grant stops working. Unix epoch milliseconds, UTC — 15 minutes after the ' +
      'confirmation. Null exactly when setupGrant is.',
    example: 1_790_380_800_000,
  })
  readonly setupGrantExpiresAt: number | null;

  constructor(verified: EmailVerified) {
    super(verified.account);
    this.setupGrant = verified.setupGrant;
    this.setupGrantExpiresAt = verified.setupGrantExpiresAt?.getTime() ?? null;
  }
}
