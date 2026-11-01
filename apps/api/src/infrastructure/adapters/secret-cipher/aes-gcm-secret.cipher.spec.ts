import { AesGcmSecretCipher, SECRET_KEY_VERSION } from './aes-gcm-secret.cipher';

/**
 * The at-rest cipher (task 27.1). The interesting cases are all refusals: a round trip proving
 * "it works" says nothing about whether a wrong key, a wrong generation or a tampered row is
 * distinguishable from a correct one, and that distinction is the whole reason `open` throws
 * where the cookie codec answers `null`.
 */
const SECRET = 'devonly-secret-encryption-key';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('AesGcmSecretCipher', () => {
  const cipher = new AesGcmSecretCipher(SECRET);

  it('round-trips a secret', () => {
    expect(cipher.open(cipher.seal(TOTP_SECRET))).toBe(TOTP_SECRET);
  });

  it('seals into the versioned envelope the database column is typed to accept', () => {
    // The literal is the wire/storage format, asserted as a literal on purpose (CLAUDE.md's
    // test exception): it must break if someone changes the prefix, which a test written in
    // terms of the constant never would. `identity.encrypted_secret`'s domain constraint is
    // the database's own copy of this shape.
    expect(cipher.seal(TOTP_SECRET)).toMatch(/^v1\.[A-Za-z0-9_-]{38,}$/u);
    expect(SECRET_KEY_VERSION).toBe(1);
  });

  it('is non-deterministic — the same secret seals differently every time', () => {
    // A fresh nonce per seal. Were it deterministic, equal ciphertexts would disclose that two
    // operators enrolled the same authenticator secret, to anyone holding a database dump.
    expect(cipher.seal(TOTP_SECRET)).not.toBe(cipher.seal(TOTP_SECRET));
  });

  it('refuses a value sealed under a different secret', () => {
    const other = new AesGcmSecretCipher('a-different-secret');
    expect(() => cipher.open(other.seal(TOTP_SECRET))).toThrow();
  });

  it('names the generation when a value was sealed under another key version', () => {
    const next = new AesGcmSecretCipher(SECRET, SECRET_KEY_VERSION + 1);
    // The point of the version travelling in the envelope: this is a rotation that has not
    // finished, and it must not present as corruption.
    expect(() => cipher.open(next.seal(TOTP_SECRET))).toThrow(/key version 2/u);
  });

  it('refuses plaintext — the row this task migrated away from', () => {
    expect(() => cipher.open(TOTP_SECRET)).toThrow(/sealed envelope form/u);
  });

  it('refuses a tampered ciphertext rather than returning altered plaintext', () => {
    const sealed = cipher.seal(TOTP_SECRET);
    // Flip the last base64url character to something else in the alphabet: GCM's tag check is
    // what turns that into a refusal, and it is the reason the mode is GCM rather than CBC.
    const flipped = `${sealed.slice(0, -1)}${sealed.at(-1) === 'A' ? 'B' : 'A'}`;
    expect(() => cipher.open(flipped)).toThrow();
  });

  it('refuses an envelope too short to carry a nonce and a tag', () => {
    expect(() => cipher.open('v1.AAAA')).toThrow(/nonce/u);
  });

  it('fails at construction when the key is absent, naming the variable', () => {
    expect(() => new AesGcmSecretCipher(undefined)).toThrow(/SECRET_ENCRYPTION_KEY/u);
    expect(() => new AesGcmSecretCipher('')).toThrow(/SECRET_ENCRYPTION_KEY/u);
  });
});
