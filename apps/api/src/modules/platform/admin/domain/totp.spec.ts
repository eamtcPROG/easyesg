import { mintTotpSecret, totpCodeAt, totpEnrolmentUri, verifyTotp } from './totp';

/**
 * Pinned to RFC 6238 Appendix B. The implementation is `otpauth` (§12.1) rather than this
 * repository's code, so what these vectors now prove is the **integration**: that the
 * parameters this domain configures — SHA-1, 6 digits, a 30-second step — are the ones the
 * standard describes, and that a base32 secret is read the way every authenticator writes it.
 * A wrong `algorithm` or `period` would pass a self-consistent round-trip test and fail here,
 * which is the whole reason to keep them.
 *
 * The appendix states 8-digit codes for the ASCII secret "12345678901234567890"; the 6-digit
 * expectations below are those values' last six digits, exactly what RFC 4226's decimal
 * reduction produces.
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

const at = (seconds: number) => new Date(seconds * 1000);

describe('TOTP (RFC 6238, SHA-1, 6 digits, 30 s step)', () => {
  it.each(RFC_VECTORS)('verifies the RFC vector at T=%d', (seconds, code) => {
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds))).toBe(true);
  });

  it.each(RFC_VECTORS)('generates the RFC vector at T=%d', (seconds, code) => {
    expect(totpCodeAt(RFC_SECRET_BASE32, at(seconds))).toBe(code);
  });

  it('accepts one step either side and refuses beyond the window', () => {
    const [seconds, code] = RFC_VECTORS[0];
    // T=59 is inside step 1 (30–59 s); the window admits steps 0–2, i.e. up to 89 s.
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds + 30))).toBe(true);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds - 30))).toBe(true);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code }, at(seconds + 61))).toBe(false);
  });

  /**
   * The regression guard for the defect that decided the implementation question (see the
   * domain file's header): at step 0 the ±1 window reaches for counter −1, and the hand-rolled
   * version threw `RangeError` there while passing every vector above. Nothing on a sign-in
   * path may throw on shape.
   */
  it('answers rather than throwing at the epoch boundary, where the window reaches below zero', () => {
    // Step 0's window covers steps 0 and 1 (and −1, which cannot exist), so T=59's code is a
    // legitimate in-window neighbour here — `true` is the right answer. What is being guarded
    // is that a verdict is REACHED at all: the hand-rolled version threw on counter −1.
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '287082' }, at(0))).toBe(true);
    // Two steps out is outside the window even at the boundary, and still no throw.
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '081804' }, at(0))).toBe(false);
    expect(totpCodeAt(RFC_SECRET_BASE32, at(0))).toMatch(/^\d{6}$/u);
  });

  it('refuses a wrong code, a malformed code, and a corrupt secret — without throwing', () => {
    const now = at(59);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '287083' }, now)).toBe(false);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: '28708' }, now)).toBe(false);
    expect(verifyTotp({ secret: RFC_SECRET_BASE32, code: 'abcdef' }, now)).toBe(false);
    expect(verifyTotp({ secret: 'not!base32', code: '287082' }, now)).toBe(false);
    expect(verifyTotp({ secret: '', code: '287082' }, now)).toBe(false);
    expect(totpCodeAt('not!base32', now)).toBeNull();
  });

  it('mints base32 secrets long enough for RFC 4226 (160 bits)', () => {
    const secret = mintTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(mintTotpSecret()).not.toBe(secret);
    // A minted secret round-trips through the verifier it was minted for.
    const code = totpCodeAt(secret, at(59));
    expect(code).not.toBeNull();
    expect(verifyTotp({ secret, code: code ?? '' }, at(59))).toBe(true);
  });

  it('emits the enrolment URI in the Key Uri Format an authenticator scans', () => {
    const uri = totpEnrolmentUri({ email: 'ana@easyesg.md', secret: RFC_SECRET_BASE32 });
    expect(uri).toBe(
      'otpauth://totp/EasyESG%20Admin:ana%40easyesg.md' +
        `?issuer=EasyESG%20Admin&secret=${RFC_SECRET_BASE32}&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
