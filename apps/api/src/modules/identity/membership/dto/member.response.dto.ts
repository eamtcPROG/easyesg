import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '../models/membership.model';
import type { OrganizationMember } from '../models/membership.model';

/**
 * One row of S-16's list (UC-59, FR-56).
 *
 * Instants are epoch-millisecond integers, converted here — the persistence-to-DTO boundary is the
 * one place that conversion happens (§6.8, OQ-50). OpenAPI can only describe them as `integer`, so
 * the unit is stated in each `@ApiProperty` because nothing else will say it.
 *
 * The enums are **derived** from the vocabularies rather than restated: declaration order becomes
 * contract order, so reordering `MEMBERSHIP_ROLE` is a diff `openapi:check` fails on instead of a
 * silent change to the published enum.
 */
export class MemberResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Identifies this membership for a role change or a removal.' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'The account holding the membership.' })
  accountId: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: Object.values(MEMBERSHIP_ROLE) })
  role: string;

  @ApiProperty({
    enum: Object.values(MEMBERSHIP_STATUS),
    description:
      'Always active in this list: a removed membership is history rather than access. Pending ' +
      'invitations are a separate resource and are not members.',
  })
  status: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds of the last request this member made against the organization, ' +
      'or null if they have not returned since being granted access.',
  })
  lastActiveAt: number | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when access was granted.' })
  joinedAt: number;

  constructor(member: OrganizationMember) {
    this.id = member.membershipId;
    this.accountId = member.accountId;
    this.email = member.email;
    this.role = member.role;
    this.status = member.status;
    this.lastActiveAt = member.lastActiveAt?.getTime() ?? null;
    this.joinedAt = member.joinedAt.getTime();
  }
}
