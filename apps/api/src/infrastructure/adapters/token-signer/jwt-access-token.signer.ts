import { JwtService } from '@nestjs/jwt';
import type { AccessTokenSigner } from '@api/modules/identity/session/interfaces/access-token-signer.interface';

/**
 * The access token, as AD-12 specifies it, behind `AccessTokenSigner` (§12.1's `@nestjs/jwt`,
 * wrapping `jsonwebtoken` 9 — CommonJS, which is why `jose` was declined there).
 *
 * **The claim set is the decision, and it is deliberately minimal**: `sub` is the session id —
 * AD-12's "`session_id` and nothing else of authorization consequence" — plus the `exp`/`iat`
 * pair. No role, no organization, no email. Task 28's guard resolves the session per request,
 * which is what bounds staleness by lookup rather than lifetime and keeps FR-58 true.
 *
 * **HS256, one symmetric secret, held by this API alone.** The issuer and the only verifier are
 * the same process class (DR-11 — both front ends are ordinary clients and verify nothing), so
 * an asymmetric pair would add key distribution for no consumer. The secret is required at
 * construction for the pepper's exact reason: a token signed with a defaulted secret is
 * indistinguishable from a correct one until verification meets it.
 *
 * `exp` is stamped from the instant the use case computed — the same value the DTO reports —
 * rather than re-derived here from a TTL, so the claim and the stated expiry cannot disagree.
 */
export class JwtAccessTokenSigner implements AccessTokenSigner {
  private readonly jwt: JwtService;

  constructor(secret: string | undefined) {
    if (!secret) {
      throw new Error(
        'AUTH_JWT_SECRET is not set. AD-12 makes the access token a signed JWT; there is no ' +
          'default to sign with, and the HTTP tier must fail at boot rather than issue tokens ' +
          'nothing can trust.',
      );
    }
    this.jwt = new JwtService({ secret });
  }

  sign(sessionId: string, expiresAt: Date): Promise<string> {
    // `exp` is seconds since the epoch (RFC 7519), floored — never a millisecond value, which
    // every verifier would read as a date thousands of years out.
    return this.jwt.signAsync({ sub: sessionId, exp: Math.floor(expiresAt.getTime() / 1000) });
  }
}
