import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE } from '../models/membership.model';
import type { AccountMembership } from '../models/membership.model';

/**
 * One organization the caller belongs to (UC-16's view half, FR-12) — what S-05's membership list
 * renders and what the global-tier switcher chooses among.
 *
 * **No `isActive` flag, deliberately.** Which organization is active is session state, and the only
 * thing that may resolve it is the server, per request, from the session record (AD-12, AD-2). A
 * flag here would be a second place that answer lives, and the switcher's own state — which one is
 * current — comes from the same resolution that scoped the page around it, not from a list item.
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

  constructor(membership: AccountMembership) {
    this.id = membership.membershipId;
    this.organizationId = membership.organizationId;
    this.organizationName = membership.organizationName;
    this.role = membership.role;
    this.joinedAt = membership.joinedAt.getTime();
  }
}
