import { hkdfSync } from 'node:crypto';
import {
  sealJson,
  unsealJson,
} from '@api/modules/platform/admin/domain/sealed-payload';
import {
  FACTOR_CHALLENGE_KIND,
  readFactorChallenge,
  type FactorChallengePayload,
} from '@api/modules/identity/session/domain/factor-challenge';
import type { FactorChallengeSealer } from '@api/modules/identity/session/interfaces/factor-challenge.interface';

/**
 * The tenant factor challenge's sealing adapter (task 27.3; §12.5.6's tenant-factor-challenge row).
 *
 * **The GCM wrapper is borrowed from `platform/admin/domain/sealed-payload.ts`, and the borrowing
 * lives here rather than in `identity/session`.** That file's own header records why it exists: the
 * wrapper was about to be written a third time, and the third copy is where a nonce-handling fix
 * stops reaching one of them. Its argument applies to a fourth copy no less. What the placement
 * buys is direction — infrastructure may reach into a module's domain (the provisioning CLI already
 * does), whereas the tenant realm's own domain reaching into the admin realm's would state a
 * dependency that is not there. If a third realm ever needs the wrapper, that is the moment to give
 * it a neutral home; two consumers is not.
 *
 * **The key is HKDF-derived from `AUTH_JWT_SECRET` under its own label**, which is
 * `JwtAdminTokens`' one-secret-two-keys split applied to this realm and adds no environment
 * variable for a value that lives five minutes. Note that the access token uses that same secret
 * *directly* as an HMAC key, and the two do not interfere: HKDF-SHA256 under a distinct `info`
 * yields a key computationally independent of HMAC-SHA256 over the same input, and — the practical
 * statement — no algorithm here is ever applied to both. Rotating the secret invalidates
 * outstanding access tokens within fifteen minutes and outstanding challenges within five, which
 * costs a re-sign-in and no data.
 */
const KEY_LENGTH_BYTES = 32;

export class SealedFactorChallenge implements FactorChallengeSealer {
  private readonly key: Buffer;

  constructor(secret: string | undefined) {
    if (!secret) {
      throw new Error(
        'AUTH_JWT_SECRET is not set. The tenant factor challenge is sealed under a key derived ' +
          'from it (§12.5.6, task 27.3); there is no default, and the HTTP tier must fail at ' +
          'boot rather than issue challenges anything could forge.',
      );
    }
    this.key = Buffer.from(
      hkdfSync('sha256', secret, '', 'easyesg-tenant-factor-challenge', KEY_LENGTH_BYTES),
    );
  }

  seal(challenge: Omit<FactorChallengePayload, 'kind'>): string {
    return sealJson({ ...challenge, kind: FACTOR_CHALLENGE_KIND }, this.key);
  }

  open(sealed: string): FactorChallengePayload | null {
    // `unsealJson` answers null for tampering, truncation, a rotated secret and garbage alike —
    // a challenge arrives from a client on every second-step request, so none of those may throw.
    return readFactorChallenge(unsealJson(sealed, this.key));
  }
}
