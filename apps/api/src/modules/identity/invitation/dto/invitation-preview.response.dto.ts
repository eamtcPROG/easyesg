import { ApiProperty } from '@nestjs/swagger';
import { INVITATION_STANDING } from '../domain/invitation-standing';
import { INVITED_ROLE } from '../models/invitation.model';
import type { InvitationPreview } from '../use-cases/preview-invitation.use-case';

/**
 * What S-03 renders before anyone accepts anything (UC-15, FR-11).
 *
 * **`standing` is always present; the three facts are present only when it is `acceptable`.** A
 * spent, revoked or lapsed link answers its standing and nothing else — not to defend against
 * enumeration (the caller holds the token, so they already know an invitation existed) but because
 * an organization's name is its own fact, and a link that has leaked into a mailing-list archive
 * should stop disclosing who invited whom the moment it stops working.
 *
 * The enums are derived from the vocabularies rather than restated, so declaration order becomes
 * contract order and a reordering is a diff `openapi:check` fails on.
 */
export class InvitationPreviewResponseDto {
  @ApiProperty({
    enum: Object.values(INVITATION_STANDING),
    description:
      'Whether the link can still be used, and if not, why. The three unusable values are ' +
      'separate because each has its own resolution and its own sentence on screen.',
  })
  standing: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The organization doing the inviting. Null unless the link is usable.',
  })
  organizationName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description:
      'The address the invitation is bound to — acceptance is refused for any other, including ' +
      'one a social provider asserts. Null unless the link is usable.',
  })
  invitedEmail: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: Object.values(INVITED_ROLE),
    description: 'The role acceptance grants. Null unless the link is usable.',
  })
  role: string | null;

  constructor(preview: InvitationPreview) {
    this.standing = preview.standing;
    this.organizationName = preview.details?.organizationName ?? null;
    this.invitedEmail = preview.details?.invitedEmail ?? null;
    this.role = preview.details?.role ?? null;
  }
}
