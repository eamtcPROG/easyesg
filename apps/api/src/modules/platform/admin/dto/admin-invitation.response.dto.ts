import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import type { AdminInvitation } from '../models/admin-invitation.model';
import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';

/** An invitation just sent (task 67.4) — never its link, which exists only in the email. */
export class AdminInvitationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Identifies the invitation for a resend or a revoke.' })
  readonly id: string;

  @ApiProperty({ format: 'email' })
  readonly email: string;

  @ApiProperty({ enum: Object.values(ADMIN_ROLE) })
  readonly role: AdminRole;

  @ApiProperty({
    type: Number,
    description: 'Unix epoch milliseconds after which the link stops working — 24 hours after sending.',
  })
  readonly expiresAt: EpochMillis;

  constructor(invitation: AdminInvitation) {
    this.id = invitation.id;
    this.email = invitation.email;
    this.role = invitation.role;
    this.expiresAt = invitation.expiresAt.getTime();
  }
}
