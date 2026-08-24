import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * The realm's sealing primitive — AES-256-GCM over a JSON value, `iv | tag | ciphertext`,
 * base64url. Extracted (24 Aug 2026 review) when the factor challenge became the second sealed
 * payload: the GCM wrapper was about to exist three times (web's codec, the session codec,
 * now this), and the third copy is where a nonce-handling fix stops reaching one of them.
 *
 * Deliberately SHAPELESS: it seals and unseals `unknown`, and each codec owns validating what
 * came out — a sealed value proves only that this api sealed it under this key, never which
 * KIND of payload it is. That is why every payload sealed with a shared key must carry its own
 * discriminator (`admin-challenge-codec.ts` is the worked example): the session and challenge
 * cookies are sealed under the same derived key, and a challenge presented as a session must
 * die on shape, not be reinterpreted.
 *
 * Framework-free; `node:crypto` is a runtime primitive, not a framework the layering keeps out.
 */
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

export function sealJson(value: unknown, key: Buffer): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** `null` for anything not sealed by this primitive under this key — tampering, truncation, a
 *  rotated secret, garbage. None may throw: sealed values arrive on every request. */
export function unsealJson(sealed: string, key: Buffer): unknown {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    if (raw.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, GCM_IV_LENGTH));
    decipher.setAuthTag(raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH));
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH)),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext) as unknown;
  } catch {
    return null;
  }
}
