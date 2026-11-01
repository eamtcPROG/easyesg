import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MEMBERSHIP_ROLE, type MembershipRole } from '../models/membership.model';

/**
 * UC-62 and UC-64's body (FR-58, FR-60).
 *
 * `@IsIn` over `Object.values(MEMBERSHIP_ROLE)` rather than a hand-written array: the validator and
 * the published enum then cannot disagree with each other or with the migration's
 * `membership_role_known` CHECK, which is the third copy and the one that would otherwise reject at
 * the database with a 500 instead of at the edge with a 400.
 *
 * No custom `message`, matching every other request DTO here. `ProblemDetailsFilter` passes
 * field-level validation output through untranslated on purpose — it is addressed to the developer
 * integrating against the API — so a catalogue key written here would be a key nothing resolves,
 * shown to the one reader it means nothing to. class-validator's default names the accepted values,
 * which is what that reader needs.
 */
export class ChangeMemberRoleRequestDto {
  @ApiProperty({
    enum: Object.values(MEMBERSHIP_ROLE),
    description:
      'The role to grant. Setting the role a member already holds is permitted and changes ' +
      'nothing. Granting organization_administrator is how a second administrator is created.',
  })
  @IsIn(Object.values(MEMBERSHIP_ROLE))
  role!: MembershipRole;
}
