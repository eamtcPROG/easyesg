import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { AdminCredentialState } from '../models/admin-credentials.model';

/**
 * `GET /api/v1/admin/credentials` — what A-19 reads (task 144; UC-212). **Never a secret and never a code.**
 * The password and the second factor have no state to report, since an operator account holds both by
 * invariant; what varies is the recovery codes.
 */
export class AdminCredentialsResponseDto {
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Unix epoch milliseconds, UTC, when the current set of recovery codes was issued. Null until the ' +
      'operator issues a first set — nothing else creates one.',
    example: 1_789_900_000_000,
  })
  readonly recoveryCodesIssuedAt: EpochMillis | null;

  @ApiProperty({
    description:
      'Unspent codes of the current set. Zero when every one has been used, and zero when none was ever ' +
      'issued — the issue date tells the two apart.',
  })
  readonly recoveryCodesRemaining: number;

  constructor(state: AdminCredentialState) {
    this.recoveryCodesIssuedAt = state.recoveryCodesIssuedAt?.getTime() ?? null;
    this.recoveryCodesRemaining = state.recoveryCodesRemaining;
  }
}
