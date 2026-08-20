import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import { ACCOUNT_STATUS, type Account, type AccountStatus } from '../models/account.model';

/**
 * The account as it leaves the API.
 *
 * **This is the persistence-to-DTO boundary, and it is the only place instants change
 * representation** (§6.8, §7.8, OQ-50). `Account` carries `Date`; the wire carries a UTC-based
 * Unix timestamp in milliseconds. OpenAPI can only describe that as `integer`, so the unit is
 * stated in `description` — nothing else in the contract will say it.
 *
 * **What is deliberately not here:** the password hash, which is not even in the row this maps from
 * (`identity.credential` is a separate table for exactly this reason), and the verification token,
 * whose raw value exists only in the email. `locale` is also absent — it is a preference the
 * profile surface owns (FR-9, FR-10), not something registration needs to echo back.
 */
export class AccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'email', example: 'ana.popescu@example.md' })
  readonly email: string;

  @ApiProperty({
    // Derived, so the contract cannot disagree with the vocabulary. Declaration order in
    // ACCOUNT_STATUS is contract order — reordering it is a contract diff openapi:check flags.
    enum: Object.values(ACCOUNT_STATUS),
    description:
      'No application data is reachable while an account is unverified (FR-1). An unverified ' +
      'account expires 7 days after registration.',
  })
  readonly status: AccountStatus;

  @ApiProperty({
    type: 'integer',
    description: 'Unix epoch milliseconds, UTC.',
    example: 1_787_356_800_000,
  })
  readonly createdAt: EpochMillis;

  @ApiProperty({
    type: 'integer',
    required: false,
    nullable: true,
    description: 'Unix epoch milliseconds, UTC. Null while the account is unverified.',
    example: 1_787_360_400_000,
  })
  readonly verifiedAt: EpochMillis | null;

  /**
   * A constructor rather than a static factory plus definite-assignment assertions. `strict` mode
   * requires every field to be assigned, and `!` on each would turn off exactly the check that
   * catches a field forgotten here when the model gains one.
   */
  constructor(account: Account) {
    this.id = account.id;
    this.email = account.email;
    this.status = account.status;
    this.createdAt = account.createdAt.getTime();
    this.verifiedAt = account.verifiedAt ? account.verifiedAt.getTime() : null;
  }
}
