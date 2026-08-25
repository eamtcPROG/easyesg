import { ApiProperty } from '@nestjs/swagger';
import { INVITED_ROLE, type PendingInvitation } from '../models/invitation.model';

/**
 * One outstanding invitation, as S-16 lists it beside the members (FR-56, FR-57).
 *
 * Instants are epoch-millisecond integers, converted here — the persistence-to-DTO boundary is the
 * one place that conversion happens (§6.8, OQ-50). OpenAPI can only describe them as `integer`, so
 * the unit is stated in each `@ApiProperty` because nothing else will say it.
 *
 * **No `status` member**, unlike `MemberResponseDto`. Every row in this collection is `pending` by
 * construction, so publishing the value would be answering a question the shape already answers —
 * and it would invite a client to branch on a field that never varies.
 *
 * **No token, and nothing derived from one.** The raw value exists only in the email; the row holds
 * its SHA-256. An administrator cannot retrieve or re-read a colleague's link, which is what keeps
 * the invitation bound to the person it names rather than to whoever can read this list.
 *
 * `expiresAt` is published and `expired` is not: the screen has a clock, the server's answer would
 * be stale by the time it rendered, and the administrator needs the date anyway to decide whether
 * to resend now.
 */
export class InvitationResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identifies this invitation for a resend or a revocation.',
  })
  id: string;

  @ApiProperty({ format: 'email', description: 'The address the invitation is bound to.' })
  email: string;

  @ApiProperty({ enum: Object.values(INVITED_ROLE) })
  role: string;

  @ApiProperty({
    type: Number,
    description:
      'Unix epoch milliseconds of the most recent issue or resend. A resend moves this, because ' +
      'it reissues the link rather than re-delivering it.',
  })
  issuedAt: number;

  @ApiProperty({
    type: Number,
    description:
      'Unix epoch milliseconds after which the link no longer works. A lapsed invitation still ' +
      'appears here — it is what holds the address, and resending it restores a working link.',
  })
  expiresAt: number;

  constructor(invitation: PendingInvitation) {
    this.id = invitation.id;
    this.email = invitation.invitedEmail;
    this.role = invitation.role;
    this.issuedAt = invitation.issuedAt.getTime();
    this.expiresAt = invitation.expiresAt.getTime();
  }
}
