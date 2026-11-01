import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { SecretCipher } from '@api/contracts/secret-cipher.port';

/**
 * The `SecretCipher` adapter — AES-256-GCM under a key HKDF-derived from `SECRET_ENCRYPTION_KEY`
 * (task 27.1; §12.5.6's secrets-at-rest and key-rotation rows).
 *
 * **Why its own environment variable rather than a third HKDF label on `AUTH_ADMIN_SECRET`,
 * which is the shape this file otherwise copies.** The two secrets have incompatible lifetimes.
 * Rotating a session secret costs one forced refresh and destroys no data — `.env.example` says
 * exactly that of `AUTH_JWT_SECRET` — whereas rotating an at-rest key requires re-encrypting
 * every row that was written under the old one. Sharing one variable would make the cheap
 * rotation silently perform the expensive one, and the failure would surface as operators unable
 * to sign in with a correct code, long after whoever rotated it had moved on.
 *
 * **The version travels in two places at once, and that is the mechanism rather than belt and
 * braces.** It is stamped into the stored envelope AND into the HKDF label, so version `n` and
 * version `n+1` are different keys derived from different secrets, and a value written under one
 * is refused by the other with the mismatch named instead of surfacing as "corrupt". Exactly one
 * version is live: there is no previous-key variable and no decrypt-under-either precedence,
 * because that would ship a mechanism for a rotation nobody has scheduled (§12.5.6's row records
 * what a rotation before OpenBao would actually cost).
 *
 * The GCM wrapper deliberately exists twice in this app. `platform/admin/domain/sealed-payload.ts`
 * seals JSON for a cookie and answers `null` for anything it cannot open, because a sealed value
 * arrives on every request and none of its failure modes may throw. This one seals a string and
 * **throws**: the values differ, the failure semantics are opposite, and merging them would mean
 * one caller inheriting the other's answer to "what does a value I cannot open mean".
 */

/**
 * The live key generation. Bumping it is a rotation, and a rotation is a data migration — see
 * §12.5.6's at-rest key-rotation row for what has to run alongside the bump.
 */
export const SECRET_KEY_VERSION = 1;

/**
 * `v<n>.<base64url>`. The dot and the lowercase `v` are what make the envelope structurally
 * unreachable by the plaintext it replaced: RFC 4648 base32, which is how every TOTP secret is
 * spelled, draws only from `A-Z2-7` and `=`. That is why the database can refuse plaintext by
 * pattern rather than by trusting the writer — `identity.encrypted_secret` carries the same
 * shape as its own domain constraint (the migration's copy is literal, per CLAUDE.md's closed
 * vocabulary exception; this one is the writer's).
 */
const ENVELOPE = /^v(\d+)\.([A-Za-z0-9_-]+)$/u;

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;

/** Version-stamped, so a bump derives a different key from the same code path. */
const deriveKey = (secret: string, version: number): Buffer =>
  Buffer.from(
    hkdfSync('sha256', secret, '', `easyesg-secret-at-rest-v${version}`, KEY_LENGTH_BYTES),
  );

export class AesGcmSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(
    secret: string | undefined,
    private readonly version: number = SECRET_KEY_VERSION,
  ) {
    if (!secret) {
      throw new Error(
        'SECRET_ENCRYPTION_KEY is not set. Recoverable secrets are stored encrypted at rest ' +
          '(NFR-61; §12.5.6, task 27.1); there is no default, because a value encrypted under ' +
          'one would be indistinguishable from a value encrypted under a real key until the ' +
          'day someone tried to rotate it.',
      );
    }
    this.key = deriveKey(secret, this.version);
  }

  seal(plaintext: string): string {
    const iv = randomBytes(GCM_IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const envelope = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
    return `v${this.version}.${envelope}`;
  }

  open(sealed: string): string {
    const parsed = ENVELOPE.exec(sealed);
    if (!parsed) {
      // Reached only by a row written before this mechanism existed, or by one hand-edited
      // since. Naming the shape rather than echoing the value: the value is a secret.
      throw new Error(
        'A stored secret is not in the sealed envelope form (§12.5.6, task 27.1). It was ' +
          'written outside the application, or predates the encryption-at-rest migration.',
      );
    }
    const [, version, payload] = parsed;
    if (Number(version) !== this.version) {
      throw new Error(
        `A stored secret was sealed under key version ${version}; this process holds only ` +
          `version ${this.version}. Rotating SECRET_ENCRYPTION_KEY requires re-encrypting ` +
          'every sealed column in the same operation (§12.5.6, at-rest key rotation).',
      );
    }
    const raw = Buffer.from(payload, 'base64url');
    if (raw.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) {
      throw new Error('A stored secret is too short to carry a nonce and an authentication tag.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, GCM_IV_LENGTH));
    decipher.setAuthTag(raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH));
    // GCM's own `final()` throws on a failed tag check, which is the authentication. Left to
    // propagate rather than wrapped: the message names the algorithm, and a caller that caught
    // it would be choosing to continue with a secret it could not authenticate.
    return Buffer.concat([
      decipher.update(raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH)),
      decipher.final(),
    ]).toString('utf8');
  }
}
