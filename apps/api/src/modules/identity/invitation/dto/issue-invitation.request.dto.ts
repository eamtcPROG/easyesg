import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { INVITED_ROLE, type InvitedRole } from '../models/invitation.model';

/**
 * UC-60's body (FR-57).
 *
 * `@IsIn` over `Object.values(INVITED_ROLE)` rather than a hand-written array: the validator and
 * the published enum then cannot disagree with each other or with the migration's
 * `invitation_role_known` CHECK, which is the third copy and the one that would otherwise reject at
 * the database with a 500 instead of at the edge with a 400.
 *
 * **The enum has two members where `/members` publishes three**, and a client reading the contract
 * can see why without being told: FR-57 invites "with an edit or view-only role", and Organization
 * Administrator is UC-64's promotion after joining.
 *
 * `@MaxLength(320)` is the addressing limit (RFC 5321's 64-octet local part plus 255-octet domain
 * plus the `@`), not a guess — an unbounded text column reachable from an authenticated route is
 * how a table grows a megabyte-long row nobody meant to store.
 *
 * No custom `message`, matching every other request DTO here: `ProblemDetailsFilter` passes
 * field-level validation output through untranslated on purpose, because it is addressed to the
 * developer integrating against the API rather than to the administrator.
 */
export class IssueInvitationRequestDto {
  @ApiProperty({
    format: 'email',
    maxLength: 320,
    description:
      'The address to invite. The invitation binds to it: acceptance is refused for any other ' +
      'address, including one a social provider asserts.',
  })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    enum: Object.values(INVITED_ROLE),
    description:
      'The role acceptance grants. Organization Administrator is not invitable — it is granted ' +
      'to an existing member instead.',
  })
  @IsIn(Object.values(INVITED_ROLE))
  role!: InvitedRole;
}
