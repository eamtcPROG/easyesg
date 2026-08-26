import {
  RECOVERY_CODE_COUNT,
  formatRecoveryCode,
  hashRecoveryCode,
  mintRecoveryCodes,
  normaliseRecoveryCode,
} from './recovery-code';

/**
 * §12.5.6's recovery-code row, as executable statements. The transcription rules are the half
 * worth pinning: every one of them exists because a person is retyping from paper at the worst
 * moment they will ever have, and a refusal there is indistinguishable to them from a spent code.
 */
describe('recovery codes', () => {
  it('mints the specified set: ten codes of sixteen characters', () => {
    const { values, hashes } = mintRecoveryCodes();
    expect(values).toHaveLength(RECOVERY_CODE_COUNT);
    expect(hashes).toHaveLength(RECOVERY_CODE_COUNT);
    // The literal is the spec's number, asserted as a literal on purpose (CLAUDE.md's test
    // exception): it must break if someone shortens the code, which a test written in terms of
    // the constant never would.
    for (const value of values) expect(value).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/u);
  });

  it('never mints the characters Crockford excludes, because they are the transcription errors', () => {
    // 2000 characters is enough that a 1-in-32 omission would show. I, L, O and U are the four.
    const drawn = new Set(
      Array.from({ length: 125 }, () => mintRecoveryCodes().values.join('')).join(''),
    );
    for (const excluded of ['I', 'L', 'O', 'U']) expect(drawn.has(excluded)).toBe(false);
  });

  it('mints distinct codes', () => {
    const { values } = mintRecoveryCodes();
    expect(new Set(values).size).toBe(RECOVERY_CODE_COUNT);
  });

  it('hashes to 32 bytes and never stores the value', () => {
    const { values, hashes } = mintRecoveryCodes();
    expect(hashes[0]).toHaveLength(32);
    expect(hashes[0].toString('utf8')).not.toContain(values[0]);
  });

  it('accepts the code as printed, hyphens and all', () => {
    const { values, hashes } = mintRecoveryCodes();
    expect(hashRecoveryCode(formatRecoveryCode(values[0]))).toEqual(hashes[0]);
    expect(formatRecoveryCode(values[0])).toHaveLength(19);
  });

  it('accepts lower case, spaces and the confusable characters a reader substitutes', () => {
    // Someone reading `0` off paper types the letter O; someone reading `1` types l or I. A
    // refusal there reads to them exactly like a spent code, which is the failure this prevents.
    // 'o0 Il1-lower' → upper 'O0 IL1-LOWER' → strip 'O0IL1LOWER' → O→0 → I,L→1.
    expect(normaliseRecoveryCode('o0 Il1-lower')).toBe('0011110WER');
    expect(hashRecoveryCode('0123456789ABCDEF')).toEqual(
      hashRecoveryCode('o123 456789-abcdef'),
    );
  });

  it('still distinguishes two genuinely different codes', () => {
    // The normalisation folds characters together, so the pair that proves it did not fold
    // everything together matters more than the pair that proves it folded anything.
    expect(hashRecoveryCode('0123456789ABCDEF')).not.toEqual(
      hashRecoveryCode('0123456789ABCDEG'),
    );
  });
});
