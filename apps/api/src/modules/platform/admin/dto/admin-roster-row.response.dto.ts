import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import {
  ADMIN_ROSTER_KIND,
  ADMIN_STANDING,
  type AdminRosterKind,
  type AdminRosterRow,
  type AdminStanding,
} from '../models/admin-roster.model';
import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';

/** One row of A-08's account table (task 67.4; UC-87) — an account, or an invitation on its way. */
export class AdminRosterRowResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The account’s id, or the invitation’s — `kind` says which, and so which routes act on it.',
  })
  readonly id: string;

  @ApiProperty({ enum: Object.values(ADMIN_ROSTER_KIND) })
  readonly kind: AdminRosterKind;

  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  readonly email: string;

  @ApiProperty({
    enum: Object.values(ADMIN_ROLE),
    description: 'The realm — fixed when the invitation was sent, never changed afterwards.',
  })
  readonly role: AdminRole;

  @ApiProperty({
    enum: Object.values(ADMIN_STANDING),
    description:
      'One word read from the facts: an account is active, locked (active and locked out after ' +
      'repeated failures), suspended or removed; an invitation is invited, or lapsed once its link ' +
      'has expired.',
  })
  readonly standing: AdminStanding;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds of the most recent sign-in. Null for an invitation, and for an account ' +
      'that has never signed in.',
  })
  readonly lastSignInAt: EpochMillis | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Unix epoch milliseconds after which an invitation’s link stops working. Null for an account.',
  })
  readonly expiresAt: EpochMillis | null;

  constructor(row: AdminRosterRow) {
    this.id = row.id;
    this.kind = row.kind;
    this.email = row.email;
    this.role = row.role;
    this.standing = row.standing;
    this.lastSignInAt = row.lastSignInAt?.getTime() ?? null;
    this.expiresAt = row.expiresAt?.getTime() ?? null;
  }
}
