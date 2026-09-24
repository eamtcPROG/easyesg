import { ApiProperty } from '@nestjs/swagger';
import type { PasswordState } from '../models/account.model';

/**
 * `GET /api/v1/account/password` — S-28's password row (task 169; `design_spec.md` OQ-19, closed 24 Sep 2026). Whether
 * a password is held and when it last changed; never the hash, and never where it was changed from, which nothing
 * records.
 */
export class PasswordStateResponseDto {
  @ApiProperty({
    description:
      'Whether the account holds a password. False for an account that signs in through a provider only, which can ' +
      'be given a first password by the reset flow.',
  })
  set: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds, UTC — when the password was last set: at registration, a change, a reset or a first ' +
      'password. A failed sign-in does not move it. Null exactly when set is false.',
  })
  changedAt: number | null;

  constructor(state: PasswordState) {
    this.set = state.set;
    // The one conversion to the wire's instant, at the persistence-to-DTO boundary (root CLAUDE.md, time rule).
    this.changedAt = state.changedAt?.getTime() ?? null;
  }
}
