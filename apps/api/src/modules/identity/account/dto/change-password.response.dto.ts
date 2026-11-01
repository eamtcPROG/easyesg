import { ApiProperty } from '@nestjs/swagger';
import type { PasswordChanged } from '../use-cases/change-password.use-case';

/**
 * What a completed password change answers (FR-7, UC-10).
 *
 * It carries a **count** rather than a bare acknowledgement, and that is UX-92's third part
 * arriving as data: a screen that says "signed out of your other devices" when there were none is
 * telling the user something that did not happen. The count lets the message be true either way,
 * and lets the caller choose the plural — which is `apps/web`'s to do, in ICU, per locale.
 */
export class PasswordChangedResponseDto {
  @ApiProperty({
    description:
      'How many other sessions were ended. Always 0 when the election was not made, and 0 is a ' +
      'normal answer when it was — the account simply had no other device signed in.',
  })
  readonly otherSessionsTerminated: number;

  constructor(changed: PasswordChanged) {
    this.otherSessionsTerminated = changed.otherSessionsTerminated;
  }
}
