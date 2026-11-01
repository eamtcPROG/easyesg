import { ApiProperty } from '@nestjs/swagger';
import type { AcceptedAdminInvitation } from '../use-cases/accept-admin-invitation.use-case';

/**
 * The account an invitation became (task 67.4). No session and no token: the new operator signs in on
 * A-01, the path that records a sign-in.
 */
export class AcceptedAdminInvitationResponseDto {
  @ApiProperty({ format: 'email', description: 'The address to sign in with.' })
  readonly email: string;

  constructor(accepted: AcceptedAdminInvitation) {
    this.email = accepted.email;
  }
}
