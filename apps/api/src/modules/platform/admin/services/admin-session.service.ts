import { Inject, Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import {
  ADMIN_CHALLENGE_KIND,
  sealAdminChallenge,
  unsealAdminChallenge,
} from '../domain/admin-challenge-codec';
import { sealAdminCookie, unsealAdminCookie } from '../domain/admin-cookie-codec';
import { ADMIN_FACTOR_CHALLENGE_TTL_MS } from '../domain/admin-session-expiry';
import {
  adminChallengeCookie,
  adminSessionCookie,
  clearedAdminChallengeCookie,
  clearedAdminSessionCookie,
} from '../constants/admin-session.constants';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import { ADMIN_TOKENS, type AdminTokens } from '../interfaces/admin-token.interface';
import type { AdminIdentity, IssuedAdminSession } from '../models/admin-session.model';
import {
  BeginAdminSignIn,
  type BeginAdminSignInCommand,
} from '../use-cases/begin-admin-sign-in.use-case';
import { CompleteAdminSignIn } from '../use-cases/complete-admin-sign-in.use-case';
import {
  RESOLVED_ADMIN_SESSION,
  ResolveAdminSession,
} from '../use-cases/resolve-admin-session.use-case';
import { SignOutAdmin } from '../use-cases/sign-out-admin.use-case';

/** Step one's answer: whose factor is now awaited, until when, and the sealed challenge. */
export interface AdminChallengeView {
  readonly email: string;
  readonly expiresAt: Date;
  readonly setCookie: string;
}

/**
 * What a session-changing operation hands the controller: the identity block and expiry for
 * the response body, and every `Set-Cookie` the operation produced — completing the handshake
 * writes two (the session, and the challenge's clear), which is why this is a list.
 */
export interface AdminSessionView {
  readonly identity: AdminIdentity;
  readonly expiresAt: Date;
  readonly setCookies?: readonly string[];
}

/**
 * The module's service — controllers call services, services call use cases (house rule), and
 * here the service additionally owns BOTH cookie boundaries, because OQ-17 makes this api the
 * realm's token handler: the sealed session and the sealed challenge are assembled and
 * dismantled in exactly this file, under the same derived key, with the codecs' shape checks
 * (and the challenge's `kind`) keeping the two unconfusable. Ambient context is the tenant
 * pattern: the client IP resolves here, on both steps — they spend one §12.5.6 budget.
 */
@Injectable()
export class AdminSessionService {
  constructor(
    private readonly beginSignInUseCase: BeginAdminSignIn,
    private readonly completeSignInUseCase: CompleteAdminSignIn,
    private readonly resolveUseCase: ResolveAdminSession,
    private readonly signOutUseCase: SignOutAdmin,
    @Inject(ADMIN_TOKENS) private readonly tokens: AdminTokens,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  /** UC-68 step one: the credential, answered with a sealed factor challenge. */
  async beginSignIn(
    input: Omit<BeginAdminSignInCommand, 'clientIp'>,
  ): Promise<AdminChallengeView> {
    const challenge = await this.beginSignInUseCase.execute({
      ...input,
      clientIp: requestContext()?.clientIp,
    });
    const sealed = sealAdminChallenge(
      {
        kind: ADMIN_CHALLENGE_KIND,
        accountId: challenge.identity.id,
        email: challenge.identity.email,
        role: challenge.identity.role,
        issuedAt: challenge.issuedAt.getTime(),
      },
      this.tokens.cookieKey(),
    );
    return {
      email: challenge.identity.email,
      expiresAt: new Date(challenge.issuedAt.getTime() + ADMIN_FACTOR_CHALLENGE_TTL_MS),
      setCookie: adminChallengeCookie(sealed, ADMIN_FACTOR_CHALLENGE_TTL_MS / 1000),
    };
  }

  /**
   * UC-68 step two: the factor against the sealed challenge. An absent or unsealable challenge
   * is the same fact — no open handshake — and answers the 401 that sends the screen back to
   * step one. Success writes the session cookie and clears the challenge in one response.
   */
  async completeSignIn(
    challengeCookieValue: string | undefined,
    input: { totpCode: string },
  ): Promise<AdminSessionView> {
    const challenge = challengeCookieValue
      ? unsealAdminChallenge(challengeCookieValue, this.tokens.cookieKey())
      : null;
    if (challenge === null) throw new AdminSessionInvalidError();

    const issued = await this.completeSignInUseCase.execute({
      challenge,
      totpCode: input.totpCode,
      clientIp: requestContext()?.clientIp,
    });
    return {
      identity: issued.identity,
      expiresAt: issued.refreshTokenExpiresAt,
      setCookies: [this.sessionCookie(issued), clearedAdminChallengeCookie()],
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
      setCookies: [this.sessionCookie(resolved.issued)],
    };
  }

  /**
   * Sign-out never refuses: an unreadable cookie still gets the clearing headers, because the
   * person asked to leave and a tamper-damaged cookie must not strand them signed in locally
   * while the server-side row — if any — dies by its lifetimes. Any half-open challenge is
   * cleared alongside.
   */
  async signOut(cookieValue: string | undefined): Promise<{ clearCookies: readonly string[] }> {
    const payload = cookieValue
      ? unsealAdminCookie(cookieValue, this.tokens.cookieKey())
      : null;
    if (payload !== null) {
      await this.signOutUseCase.execute({ refreshToken: payload.refreshToken });
    }
    return { clearCookies: [clearedAdminSessionCookie(), clearedAdminChallengeCookie()] };
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
