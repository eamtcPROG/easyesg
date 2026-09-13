import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { REQUIRED_ADMIN_ROLES } from '../constants/admin-realm.constants';
import { readAdminSessionCookie } from '../constants/admin-session.constants';
import { AdminInsufficientRoleError } from '../errors/admin-session.errors';
import type { AdminRole } from '../models/admin-session.model';
import { AdminSessionService } from '../services/admin-session.service';

const SET_COOKIE = 'set-cookie';

/**
 * The admin realm's gate (task 67.3; `architecture.md` §6.2 and §12.5.6's task-67.3 row) — what
 * `public.decorator.ts` promised would turn the realm's own checking into a chain.
 *
 * **It judges the session the way the probe does, because it is the same judgement.** The sealed
 * cookie goes through `AdminSessionService.resolve` — task 145's per-request read: a revoked,
 * missing or deactivated session answers `authentication-required`, a lifetime run out
 * `session-expired`. There is no second implementation to disagree with `GET /auth/admin/session`.
 *
 * **It sets the successor cookie when the session rotates, before it compares the role.** Rotation
 * consumes the presented refresh token, so a response that dropped the successor would sign the
 * operator out on their next request — and it must be set even when the role is then refused,
 * because the rotation has already happened.
 *
 * **It writes `adminAccountId`, never `actorId`.** `actorId` is the tenant actor that
 * `core.capture_field_change` attributes writes to; an admin account id there would attribute a
 * tenant write to an account from another realm's table. The register's acquisition log reads this.
 *
 * **Fail-closed at every gap**, as `RequiresRoleGuard` is: no metadata means the decorator was not
 * applied and the guard stands aside — which cannot happen, since only `@RequiresAdminRole` applies
 * it — and every other gap refuses.
 */
@Injectable()
export class AdminRealmGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AdminSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      REQUIRED_ADMIN_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) return true;

    const http = context.switchToHttp();
    const view = await this.sessions.resolve(
      readAdminSessionCookie(http.getRequest<Request>().headers.cookie),
    );

    if (view.setCookies) http.getResponse<Response>().setHeader(SET_COOKIE, [...view.setCookies]);

    if (!required.includes(view.identity.role)) throw new AdminInsufficientRoleError();

    const ctx = requestContext();
    if (ctx) ctx.adminAccountId = view.identity.id;
    return true;
  }
}
