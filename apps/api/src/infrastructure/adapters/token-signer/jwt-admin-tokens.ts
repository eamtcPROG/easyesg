import { hkdfSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { AdminTokens } from '@api/modules/platform/admin/interfaces/admin-token.interface';

/**
 * The admin realm's token adapter (task 23; §12.5.6's task-23 rows) — `JwtAccessTokenSigner`'s
 * claim discipline (`sub` = session id, `exp`, `iat`, nothing else) plus the two things that
 * realm needs and the tenant one refused: **verify**, because the api is this realm's own token
 * handler (OQ-17) and judges the sealed cookie on every resolve; and the **HKDF key split** —
 * one `AUTH_ADMIN_SECRET`, two derived keys under distinct labels, so the HS256 signing key and
 * the cookie's AES-256-GCM sealing key rotate together and can never be each other.
 *
 * Deriving from the tenant `AUTH_JWT_SECRET` was rejected by name: NFR-65's "no shared
 * credential" includes the signing key, and disjoint secrets are what make a tenant access
 * token structurally unable to verify as an admin one — no `aud` claim to forget to check.
 */
const KEY_LENGTH_BYTES = 32;

const deriveKey = (secret: string, label: string): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, '', label, KEY_LENGTH_BYTES));

export class JwtAdminTokens implements AdminTokens {
  private readonly jwt: JwtService;
  private readonly sealingKey: Buffer;

  constructor(secret: string | undefined) {
    if (!secret) {
      throw new Error(
        'AUTH_ADMIN_SECRET is not set. The admin realm signs and seals with keys derived from ' +
          'it (§12.5.6, task 23); there is no default, and the HTTP tier must fail at boot ' +
          'rather than issue admin sessions nothing can trust.',
      );
    }
    this.jwt = new JwtService({ secret: deriveKey(secret, 'easyesg-admin-jwt') });
    this.sealingKey = deriveKey(secret, 'easyesg-admin-cookie');
  }

  sign(sessionId: string, expiresAt: Date): Promise<string> {
    // `exp` in seconds since the epoch (RFC 7519), floored — see JwtAccessTokenSigner.
    return this.jwt.signAsync({ sub: sessionId, exp: Math.floor(expiresAt.getTime() / 1000) });
  }

  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      // Validated, never cast: a token this adapter signed carries a string `sub`, so anything
      // else is not ours whatever the signature says.
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      // Expired IS the resolve path's rotate signal; malformed and forged collapse into it
      // because the rotation attempt that follows fails on the refresh token anyway.
      return null;
    }
  }

  cookieKey(): Buffer {
    return this.sealingKey;
  }
}
