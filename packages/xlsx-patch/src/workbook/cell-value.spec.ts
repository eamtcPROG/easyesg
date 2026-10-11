import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL } from '../patch-refusal.js';
import { refusalOf } from '../testing/refusal-of.js';
import { CELL_VALUE_KIND, cellBody, escapeCellText } from './cell-value.js';

const number = (value: string) => cellBody({ kind: CELL_VALUE_KIND.NUMBER, value });
const text = (value: string) => cellBody({ kind: CELL_VALUE_KIND.TEXT, value });

describe('a value as a cell carries it', () => {
  it('writes a number as the decimal it was given, with no type', () => {
    expect(number('12.5')).toEqual({ type: null, children: '<v>12.5</v>' });
    expect(number('-0.000123')).toEqual({ type: null, children: '<v>-0.000123</v>' });
    expect(number('0')).toEqual({ type: null, children: '<v>0</v>' });
  });

  it('counts significant digits between the first and last that are not zero', () => {
    expect(number('123456789012345').children).toBe('<v>123456789012345</v>');
    expect(number('0.000123456789012345').children).toBe('<v>0.000123456789012345</v>');
    expect(number('100000000000000000000').children).toBe('<v>100000000000000000000</v>');
    expect(refusalOf(() => number('1234567890123456'))).toBe(PATCH_REFUSAL.MALFORMED_NUMBER);
    expect(refusalOf(() => number('1.234567890123456'))).toBe(PATCH_REFUSAL.MALFORMED_NUMBER);
  });

  it('refuses what is not a plain decimal', () => {
    for (const value of ['', '1e5', '1,5', '+1', '.5', '5.', 'NaN', 'Infinity', ' 1', '0x10']) {
      expect(refusalOf(() => number(value))).toBe(PATCH_REFUSAL.MALFORMED_NUMBER);
    }
  });

  it('writes text as an inline string, whitespace preserved', () => {
    expect(text('  Brutăria  ')).toEqual({ type: 'inlineStr', children: '<is><t xml:space="preserve">  Brutăria  </t></is>' });
  });

  it('writes text that looks like a formula as text, which is all a cell of this type can hold (NFR-70)', () => {
    expect(text('=HYPERLINK("http://x","y")').children).toBe('<is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;,&quot;y&quot;)</t></is>');
  });

  it('writes a boolean as Excel’s 1 or 0', () => {
    expect(cellBody({ kind: CELL_VALUE_KIND.BOOLEAN, value: true })).toEqual({ type: 'b', children: '<v>1</v>' });
    expect(cellBody({ kind: CELL_VALUE_KIND.BOOLEAN, value: false })).toEqual({ type: 'b', children: '<v>0</v>' });
  });

  it('refuses text a cell cannot hold — a lone surrogate, or more than 32,767 characters', () => {
    expect(refusalOf(() => text('a\uD800b'))).toBe(PATCH_REFUSAL.MALFORMED_TEXT);
    expect(refusalOf(() => text('x'.repeat(32_768)))).toBe(PATCH_REFUSAL.MALFORMED_TEXT);
    expect(refusalOf(() => text('x'.repeat(32_767)))).toBeNull();
  });
});

describe('ST_Xstring', () => {
  it('escapes for XML', () => {
    expect(escapeCellText('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });

  it('keeps a tab and a line feed, and encodes a carriage return so it does not read back as a line feed', () => {
    expect(escapeCellText('a\tb\nc\r\nd')).toBe('a\tb\nc_x000D_\nd');
  });

  it('encodes a control character XML 1.0 cannot carry', () => {
    expect(escapeCellText('a\u0001b\u001Fc￾d')).toBe('a_x0001_b_x001F_c_xFFFE_d');
  });

  it('keeps text that already looks like an escape from being decoded', () => {
    expect(escapeCellText('price_x0041_')).toBe('price_x005F_x0041_');
  });

  it('leaves a supplementary-plane character whole', () => {
    expect(escapeCellText('🌍')).toBe('🌍');
  });
});
