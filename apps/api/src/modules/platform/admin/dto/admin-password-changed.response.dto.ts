import { ApiProperty } from '@nestjs/swagger';
import type { AdminPasswordChanged } from '../models/admin-credentials.model';

/**
 * What a completed password change answers on A-19 (task 144) — a **count**, the tenant
 * `PasswordChangedResponseDto`'s reason: a screen saying *signed out of your other devices* when there were
 * none tells the operator something that did not happen.
 */
export class AdminPasswordChangedResponseDto {
  @ApiProperty({
    description:
      'How many other sessions were ended. Always 0 when the election was not made, and 0 is a normal ' +
      'answer when it was.',
  })
  readonly otherSessionsTerminated: number;

  constructor(changed: AdminPasswordChanged) {
    this.otherSessionsTerminated = changed.otherSessionsTerminated;
  }
}
