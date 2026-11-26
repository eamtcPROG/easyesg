import { describe, expect, it } from 'vitest';
import { ANSWER_MAX_LENGTH, answerIsTooLong } from './answer-length';

/**
 * The bound at its edges (task 259). The api refuses a value with `answerIsTooLong` and S-07 judges its draft with it,
 * so a case pinned here holds at both sites at once.
 */
describe('answer length (task 259)', () => {
  it('is the 32,767 characters one cell of the EFRAG Digital Template holds', () => {
    expect(ANSWER_MAX_LENGTH).toBe(32_767);
  });

  it('admits a text of exactly the bound, and refuses one character more', () => {
    expect(answerIsTooLong('a'.repeat(ANSWER_MAX_LENGTH))).toBe(false);
    expect(answerIsTooLong('a'.repeat(ANSWER_MAX_LENGTH + 1))).toBe(true);
  });

  it('counts as the workbook counts — a character outside the Basic Multilingual Plane is two units', () => {
    // 16,384 of them is 32,768 units: one past the bound, though only 16,384 characters to a reader.
    const astral = '🌿'.repeat(16_384);
    expect([...astral]).toHaveLength(16_384);
    expect(answerIsTooLong(astral)).toBe(true);
  });

  it('counts a Romanian or Russian letter as one unit, as a cell does', () => {
    expect(answerIsTooLong('ș'.repeat(ANSWER_MAX_LENGTH))).toBe(false);
    expect(answerIsTooLong('ж'.repeat(ANSWER_MAX_LENGTH + 1))).toBe(true);
  });

  it('judges no text the value does not carry', () => {
    expect(answerIsTooLong(null)).toBe(false);
    expect(answerIsTooLong(undefined)).toBe(false);
    expect(answerIsTooLong('')).toBe(false);
  });
});
