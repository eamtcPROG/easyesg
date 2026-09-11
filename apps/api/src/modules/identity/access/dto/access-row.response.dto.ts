import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { ACCESS_ROW_KIND, ACCESS_STANDING, type AccessRow } from '../models/access.model';

/**
 * One row of S-16's merged list (UC-59, FR-56; task 131).
 *
 * **Flat on the wire, a union in both tiers.** `AccessRow` is a discriminated union and stays one in
 * the API's model and in the browser's, because `expiresAt` on a member is not a null — it is a
 * question that does not apply. OpenAPI cannot express that without a `oneOf` the generator turns
 * into something neither tier wants to read, so the wire carries `kind` plus nullable members and
 * each side narrows on it. The nullability is documented per field rather than left to be inferred,
 * because *"null because this row is a member"* and *"null because nothing is known"* are different
 * facts and only one of them is ever true here.
 *
 * Instants are epoch-millisecond integers, converted at this boundary and nowhere else (§6.8,
 * OQ-50). OpenAPI can only describe them as `integer`, so each `@ApiProperty` states the unit.
 *
 * The enums are **derived** from the vocabularies rather than restated, so declaration order becomes
 * contract order and a reorder is a diff `openapi:check` fails on rather than a silent change.
 */
export class AccessRowResponseDto {
  @ApiProperty({
    enum: Object.values(ACCESS_ROW_KIND),
    description:
      'Which collection this row came from, and the discriminator for the fields below. A member ' +
      'holds access now; an invitation has been sent and not accepted.',
  })
  kind: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The handle this row’s actions need — a membership id for a member, an invitation id for an ' +
      'invitation. Unique within its own collection only, so a caller keying rows must qualify it ' +
      'with `kind`.',
  })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({
    enum: Object.values(MEMBERSHIP_ROLE),
    description: 'The role held, or for an invitation the role it will grant when accepted.',
  })
  role: string;

  @ApiProperty({
    enum: Object.values(ACCESS_STANDING),
    description:
      'Derived server-side from now(): a member is always active, and a pending invitation is ' +
      'invited or invitation_expired according to its own expiry. Expired invitations are ' +
      'published rather than hidden — an expired one is what refuses a re-invite with a 409, so ' +
      'hiding it would leave an administrator holding a conflict they cannot see or resend.',
  })
  standing: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The account holding the membership. Null when kind is invitation — nobody holds it yet.',
  })
  accountId: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds when access was granted. Null when kind is invitation, which has ' +
      'not been accepted and so granted nothing.',
  })
  joinedAt: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds of this member’s last request. Null when they have not returned ' +
      'since being granted access, and null for an invitation.',
  })
  lastActiveAt: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds when the invitation was last issued — a resend moves this and ' +
      'restarts the window. Null when kind is member.',
  })
  issuedAt: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix epoch milliseconds when the invitation lapses. Null when kind is member.',
  })
  expiresAt: number | null;

  constructor(row: AccessRow) {
    this.kind = row.kind;
    this.id = row.id;
    this.email = row.email;
    this.role = row.role;
    this.standing = row.standing;

    const member = row.kind === ACCESS_ROW_KIND.MEMBER ? row : null;
    const invitation = row.kind === ACCESS_ROW_KIND.INVITATION ? row : null;

    this.accountId = member?.accountId ?? null;
    this.joinedAt = member?.joinedAt.getTime() ?? null;
    this.lastActiveAt = member?.lastActiveAt?.getTime() ?? null;
    this.issuedAt = invitation?.issuedAt.getTime() ?? null;
    this.expiresAt = invitation?.expiresAt.getTime() ?? null;
  }
}
