import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';
import type { AdminInvitationPreview } from '../use-cases/preview-admin-invitation.use-case';

/** What a live link invites (task 67.4; A-20) — the address and the realm, and when it lapses. */
export class AdminInvitationPreviewResponseDto {
  @ApiProperty({ format: 'email', description: 'The address the account will hold.' })
  readonly email: string;

  @ApiProperty({ enum: Object.values(ADMIN_ROLE), description: 'The realm the account will belong to.' })
  readonly role: AdminRole;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds after which the link stops working.' })
  readonly expiresAt: EpochMillis;

  constructor(preview: AdminInvitationPreview) {
    this.email = preview.email;
    this.role = preview.role;
    this.expiresAt = preview.expiresAt.getTime();
  }
}
