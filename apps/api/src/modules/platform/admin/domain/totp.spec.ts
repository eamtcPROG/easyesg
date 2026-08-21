import { decodeBase32, mintTotpSecret, totpEnrolmentUri, verifyTotp } from './totp';

/**
 * Pinned to RFC 6238 Appendix B — the standard ships its own vectors, and a hand-rolled
 * implementation is only defensible while they pass verbatim. The appendix states 8-digit
 * codes for the ASCII secret "12345678901234567890"; the 6-digit expectations below are those
 * values' last six digits, which is exactly what RFC 4226's decimal reduction produces.
 */
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

/** (T in seconds, 6-digit TOTP) from RFC 6238 Appendix B's SHA-1 rows. */
const RFC_VECTORS: ReadonlyArray<readonly [number, string]> = [
  [59, '287082'],
  [1_111_111_109, '081804'],
  [1_111_111_111, '050471'],
  [1_234_567_890, '005924'],
  [2_000_000_000, '279037'],
  [20_000_000_000, '353130'],
];

describe('TOTP (RFC 6238, SHA-1, 6 digits, 30 s step)', () => {
  it.each(RFC_VECTORS)('accepts the RFC vector at T=%d', (seconds, code) => {
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, new Date(seconds * 1000))).toBe(true);
  });

  it('decodes the RFC secret to its ASCII bytes', () => {
    expect(decodeBase32(RFC_SECRET_BASE32)?.toString('utf8')).toBe('12345678901234567890');
  });

  it('accepts one step either side and refuses beyond the window', () => {
    const [seconds, code] = RFC_VECTORS[0];
    const at = (s: number) => new Date(s * 1000);
    // T=59 is inside step 1 (30–59 s); the window admits steps 0–2, i.e. up to 89 s.
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds + 30))).toBe(true);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds - 30))).toBe(true);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds + 61))).toBe(false);
  });

  it('refuses a wrong code, a malformed code, and a corrupt secret — without throwing', () => {
    const now = new Date(59 * 1000);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '287083' }, now)).toBe(false);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '28708' }, now)).toBe(false);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: 'abcdef' }, now)).toBe(false);
    expect(verifyTotp({ secret: 'not!base32', code: '287082' }, now)).toBe(false);
    expect(verifyTotp({ secret: '', code: '287082' }, now)).toBe(false);
  });

  it('mints base32 secrets long enough for RFC 4226 (160 bits)', () => {
    const secret = mintTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(decodeBase32(secret)?.length).toBe(20);
    expect(mintTotpSecret()).not.toBe(secret);
  });

  it('emits the enrolment URI in the Key Uri Format an authenticator scans', () => {
    const uri = totpEnrolmentUri('ana@easyesg.md', RFC_SECRET_BASE32);
    expect(uri).toBe(
      'otpauth://totp/EasyESG%20Admin:ana%40easyesg.md' +
        `?secret=${RFC_SECRET_BASE32}&issuer=EasyESG%20Admin&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
