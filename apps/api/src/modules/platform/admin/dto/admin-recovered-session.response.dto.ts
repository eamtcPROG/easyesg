import { ApiProperty } from '@nestjs/swagger';
import type { AdminRecoveredSessionView } from '../services/admin-session.service';
import { AdminSessionResponseDto } from './admin-session.response.dto';

/**
 * A recovery sign-in's answer (task 144) — the session as A-01's completed pair answers it, and how many
 * recovery codes the operator has left, which is what A-01's notice after a recovery counts down. Like its
 * parent, it carries no token: the pair is sealed in the cookie.
 */
export class AdminRecoveredSessionResponseDto extends AdminSessionResponseDto {
  @ApiProperty({
    description:
      'Unspent recovery codes left after the one this sign-in used. Zero is a real answer: the operator ' +
      'should issue a new set before they need one.',
  })
  readonly recoveryCodesRemaining: number;

  constructor(view: AdminRecoveredSessionView) {
    super(view);
    this.recoveryCodesRemaining = view.recoveryCodesRemaining;
  }
}
