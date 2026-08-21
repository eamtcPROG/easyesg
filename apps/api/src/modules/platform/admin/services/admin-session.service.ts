import { Inject, Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { sealAdminCookie, unsealAdminCookie } from '../domain/admin-cookie-codec';
import {
  adminSessionCookie,
  clearedAdminSessionCookie,
} from '../constants/admin-session.constants';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import { ADMIN_TOKENS, type AdminTokens } from '../interfaces/admin-token.interface';
import type { AdminIdentity, IssuedAdminSession } from '../models/admin-session.model';
import {
  RESOLVED_ADMIN_SESSION,
  ResolveAdminSession,
} from '../use-cases/resolve-admin-session.use-case';
import { SignInAdmin, type SignInAdminCommand } from '../use-cases/sign-in-admin.use-case';
import { SignOutAdmin } from '../use-cases/sign-out-admin.use-case';

/**
 * What every admin-session operation hands the controller: the identity block and expiry for
 * the response body, and the `Set-Cookie` header value where the operation changed the session
 * — absent when nothing did (a resolve inside the access window writes nothing).
 */
export interface AdminSessionView {
  readonly identity: AdminIdentity;
  readonly expiresAt: Date;
  readonly setCookie?: string;
}

/**
 * The module's service — controllers call services, services call use cases (house rule), and
 * here the service additionally owns the COOKIE boundary, because OQ-17 makes this api the
 * realm's token handler: the sealed value is assembled and dismantled in exactly this file, so
 * neither the controller (transport) nor the use cases (framework-free) ever see the codec or
 * the sealing key. Ambient context is the tenant pattern: the client IP resolves here.
 */
@Injectable()
export class AdminSessionService {
  constructor(
    private readonly signInUseCase: SignInAdmin,
    private readonly resolveUseCase: ResolveAdminSession,
    private readonly signOutUseCase: SignOutAdmin,
    @Inject(ADMIN_TOKENS) private readonly tokens: AdminTokens,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  async signIn(input: Omit<SignInAdminCommand, 'clientIp'>): Promise<AdminSessionView> {
    const issued = await this.signInUseCase.execute({
      ...input,
      clientIp: requestContext()?.clientIp,
    });
    return {
      identity: issued.identity,
      expiresAt: issued.refreshTokenExpiresAt,
      setCookie: this.sessionCookie(issued),
    };
  }

  /**
   * The per-request judgement: unseal, then let the use case decide current-or-rotate. An
   * absent or unsealable cookie is the same fact — no session — and answers the same 401.
   */
  async resolve(cookieValue: string | undefined): Promise<AdminSessionView> {
    const payload = cookieValue
      ? unsealAdminCookie(cookieValue, this.tokens.cookieKey())
      : null;
    if (payload === null) throw new AdminSessionInvalidError();

    const resolved = await this.resolveUseCase.execute({ payload });
    if (resolved.kind === RESOLVED_ADMIN_SESSION.CURRENT) {
      return {
        identity: resolved.identity,
        expiresAt: new Date(payload.refreshTokenExpiresAt),
      };
    }
    return {
      identity: resolved.issued.identity,
      expiresAt: resolved.issued.refreshTokenExpiresAt,
      setCookie: this.sessionCookie(resolved.issued),
    };
  }

  /**
   * Sign-out never refuses: an unreadable cookie still gets the clearing header, because the
   * person asked to leave and a tamper-damaged cookie must not strand them signed in locally
   * while the server-side row — if any — dies by its lifetimes.
   */
  async signOut(cookieValue: string | undefined): Promise<{ clearCookie: string }> {
    const payload = cookieValue
      ? unsealAdminCookie(cookieValue, this.tokens.cookieKey())
      : null;
    if (payload !== null) {
      await this.signOutUseCase.execute({ refreshToken: payload.refreshToken });
    }
    return { clearCookie: clearedAdminSessionCookie() };
  }

  private sessionCookie(issued: IssuedAdminSession): string {
    const sealed = sealAdminCookie(
      {
        accessToken: issued.accessToken,
        accessTokenExpiresAt: issued.accessTokenExpiresAt.getTime(),
        refreshToken: issued.refreshToken,
        refreshTokenExpiresAt: issued.refreshTokenExpiresAt.getTime(),
        identity: issued.identity,
      },
      this.tokens.cookieKey(),
    );
    const maxAgeSeconds = Math.floor(
      (issued.refreshTokenExpiresAt.getTime() - this.now().getTime()) / 1000,
    );
    return adminSessionCookie(sealed, maxAgeSeconds);
  }
}
