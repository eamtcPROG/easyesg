import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE, type MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import type { OrganizationMember } from '../models/organization-member.model';

/**
 * One person in an organization, as A-02's record lists them (task 167; §12.5.6's task-167 row) — how support
 * reaches the person an account belongs to. **The phone is not here**, only whether one was given: the number is
 * `POST …/phone-disclosure`'s, one person at a time and logged.
 */
export class OrganizationMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({
    example: 'Ana Popescu',
    description: 'Both name parts, or the one given, or the sign-in address where the person gave neither.',
  })
  displayName: string;

  @ApiProperty({ example: 'ana@lina.md', description: 'The sign-in address.' })
  email: string;

  @ApiProperty({ enum: Object.values(MEMBERSHIP_ROLE) })
  role: MembershipRole;

  @ApiProperty({ description: 'Whether the person gave a phone number, which support may then ask to see.' })
  hasPhone: boolean;

  constructor(member: OrganizationMember) {
    this.accountId = member.accountId;
    this.displayName = member.displayName;
    this.email = member.email;
    this.role = member.role;
    this.hasPhone = member.hasPhone;
  }
}
