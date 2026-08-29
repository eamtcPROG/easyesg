import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE } from '../models/membership.model';
import type { AccountMembershipView } from '../models/membership.model';

/**
 * One organization the caller belongs to (UC-16's view half, FR-12) — what S-05's membership list
 * renders and what the global-tier switcher chooses among.
 *
 * **`active` carries which one this request resolved to, and it reverses what this docblock said**
 * (29 Aug 2026, task 30.1, project owner). The sentence here read *"No `isActive` flag,
 * deliberately … the switcher's own state comes from the same resolution that scoped the page
 * around it, not from a list item"*. Its principle stands — only the server may resolve the active
 * organization, once, per request, from the session (AD-12, AD-2) — but its premise did not: it
 * assumed a caller could learn that resolution some other way, and none exists. `GET /organization`
 * is `@RequiresRole(ORGANIZATION_ADMINISTRATOR)`, so a viewer or an editor cannot read it, while
 * UX-2 requires the active organization to be visible on **every** authenticated screen for every
 * actor. So this is not a second answer: it is `AuthGuard`'s `selectActiveMembership` result,
 * already on the request context, projected onto the read that carries the names. Declined: a new
 * `GET /session` returning the resolved context, which is a route rather than a field and belongs
 * with task 83's `PUT /session/organization`.
 */
export class AccountMembershipResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Identifies this membership.' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'The organization the caller belongs to.' })
  organizationId: string;

  @ApiProperty({ description: 'Shown in the organization switcher and on the home screen.' })
  organizationName: string;

  @ApiProperty({
    enum: Object.values(MEMBERSHIP_ROLE),
    description: 'The role held in THIS organization. It may differ in each of them.',
  })
  role: string;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when access was granted.' })
  joinedAt: number;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether this request is acting for this organization. Exactly one membership carries it ' +
      'once a preference is settled; **none does** while the caller holds several and has stated ' +
      'no preference, which is a normal state and the one the organization switcher resolves. It ' +
      'is resolved per request from the session and is never a property of the membership row.',
  })
  active: boolean;

  constructor(membership: AccountMembershipView) {
    this.id = membership.membershipId;
    this.organizationId = membership.organizationId;
    this.organizationName = membership.organizationName;
    this.role = membership.role;
    this.joinedAt = membership.joinedAt.getTime();
    this.active = membership.active;
  }
}
