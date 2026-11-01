import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import {
  ADMIN_ROLE,
  type AdminIdentity,
  type AdminRole,
} from '../models/admin-session.model';
import type { AdminSessionView } from '../services/admin-session.service';

/** The operator as the console may know them — identity, never authorization (AD-12). */
export class AdminAccountDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  readonly email: string;

  @ApiProperty({
    enum: Object.values(ADMIN_ROLE),
    description: 'The platform-side actor (actors.md: PA or BO).',
  })
  readonly role: AdminRole;

  constructor(identity: AdminIdentity) {
    this.id = identity.id;
    this.email = identity.email;
    this.role = identity.role;
  }
}

/**
 * A session as the console sees it — and what is deliberately NOT here is the entire point
 * (OQ-17, §12.5.6's task-23 rows): no access token, no refresh token. The pair exists only
 * sealed inside the httpOnly cookie this api sets, so no token ever appears in a response body
 * browser JavaScript can read. The tenant `SessionResponseDto` carries its tokens because its
 * caller is `apps/web`'s server tier; this one's caller is the browser itself.
 */
export class AdminSessionResponseDto {
  @ApiProperty({ type: AdminAccountDto })
  readonly account: AdminAccountDto;

  @ApiProperty({
    type: 'integer',
    description:
      'Unix epoch milliseconds, UTC. When the session dies if never used again — the earlier ' +
      'of its idle (8 h) and absolute (12 h) bounds.',
    example: 1_787_444_100_000,
  })
  readonly expiresAt: EpochMillis;

  constructor(view: AdminSessionView) {
    this.account = new AdminAccountDto(view.identity);
    this.expiresAt = view.expiresAt.getTime();
  }
}
