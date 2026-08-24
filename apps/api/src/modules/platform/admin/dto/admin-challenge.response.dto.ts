import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { AdminChallengeView } from '../services/admin-session.service';

/**
 * Step one's answer: whose factor is awaited and until when — A-01's factor screen renders
 * "Signed in as {email}" from this, a fact the server established. The challenge itself is the
 * sealed httpOnly cookie on this response, never the body (OQ-17's discipline, unchanged).
 */
export class AdminChallengeResponseDto {
  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  readonly email: string;

  @ApiProperty({
    type: 'integer',
    description:
      'Unix epoch milliseconds, UTC. When the challenge lapses and sign-in restarts from the ' +
      'credential (§12.5.6 — five minutes).',
    example: 1_787_444_100_000,
  })
  readonly expiresAt: EpochMillis;

  constructor(view: AdminChallengeView) {
    this.email = view.email;
    this.expiresAt = view.expiresAt.getTime();
  }
}
