import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANSWER_MAX_LENGTH, answerIsTooLong } from '@easyesg/validation';
import { CELL_TARGET, CELL_VALUE_KIND, PATCH_REFUSAL, XlsxPatchRefusedError, patchWorkbook } from '@easyesg/xlsx-patch';

const ROOT = resolve(process.cwd(), '../..');

/** Each registered template binary, as `config/efrag/` holds it. */
const TEMPLATES = [
  ['1.3.0', 'VSME-Digital-Template-1.3.0.xlsx'],
  ['1.2.0', 'VSME-Digital-Template-1.2.0.xlsx'],
] as const;

/** The undertaking's name: a text cell both templates name, which is where any text answer would meet a cell. */
const TEXT_CELL = { kind: CELL_TARGET.NAMED, name: 'template_reporting_entity_name' } as const;

const writing = (template: Uint8Array, text: string) => () =>
  patchWorkbook({ template, writes: [{ at: TEXT_CELL, value: { kind: CELL_VALUE_KIND.TEXT, value: text } }] });

const refusalOf = (attempt: () => unknown): string | null => {
  try {
    attempt();
    return null;
  } catch (error) {
    if (error instanceof XlsxPatchRefusedError) return error.refusal;
    throw error;
  }
};

/**
 * **The text bound is what the Excel export can write, measured rather than restated** (task 259; §12.5.6's task-259
 * row). `@easyesg/validation`'s bound and `@easyesg/xlsx-patch`'s refusal are two declarations of one fact, the
 * template's cell; this holds them equal through the writer itself, so moving either alone fails here.
 */
describe('a text answer at the bound, in each registered template', () => {
  it.each(TEMPLATES)('fits one cell of %s, and one character more is refused as the write refuses it', (version, file) => {
    const template = new Uint8Array(readFileSync(resolve(ROOT, 'config/efrag', version, file)));
    const atBound = 'ș'.repeat(ANSWER_MAX_LENGTH);
    const past = `${atBound}a`;

    expect(answerIsTooLong(atBound)).toBe(false);
    expect(refusalOf(writing(template, atBound))).toBeNull();

    expect(answerIsTooLong(past)).toBe(true);
    expect(refusalOf(writing(template, past))).toBe(PATCH_REFUSAL.MALFORMED_TEXT);
  });

  it('counts as the workbook counts: a character outside the Basic Multilingual Plane is two units to both', () => {
    const [version, file] = TEMPLATES[0];
    const template = new Uint8Array(readFileSync(resolve(ROOT, 'config/efrag', version, file)));
    // 16,384 characters, 32,768 units: one unit past the bound.
    const astral = '🌿'.repeat(16_384);

    expect(answerIsTooLong(astral)).toBe(true);
    expect(refusalOf(writing(template, astral))).toBe(PATCH_REFUSAL.MALFORMED_TEXT);
  });
});
