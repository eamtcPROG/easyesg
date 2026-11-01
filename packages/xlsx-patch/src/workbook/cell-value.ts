import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { escapeXml } from './xml-text.js';

/** The kinds of value a patch writes. There is no formula among them, by design (182/32; NFR-70). */
export const CELL_VALUE_KIND = {
  /** A decimal, as a string — the platform's decimals never pass through a float on their way into the file (NFR-58). */
  NUMBER: 'number',
  TEXT: 'text',
  BOOLEAN: 'boolean',
} as const;
export type CellValueKind = (typeof CELL_VALUE_KIND)[keyof typeof CELL_VALUE_KIND];

export type CellValue =
  | { readonly kind: typeof CELL_VALUE_KIND.NUMBER; readonly value: string }
  | { readonly kind: typeof CELL_VALUE_KIND.TEXT; readonly value: string }
  | { readonly kind: typeof CELL_VALUE_KIND.BOOLEAN; readonly value: boolean };

/** What a cell element carries for a value: its `t` attribute (none for a number) and its children. */
export interface CellBody {
  readonly type: string | null;
  readonly children: string;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
/** An IEEE double holds 15 significant decimal digits exactly; Excel stores every number as one. */
const MAX_SIGNIFICANT_DIGITS = 15;
/** The most characters one cell holds, counted as Excel counts them, in UTF-16 code units. */
const MAX_TEXT_LENGTH = 32_767;

/**
 * The element body that writes a value — a number as `<v>`, text as an inline string, a boolean as `t="b"`.
 *
 * **Text is an inline string, not an entry in the shared-string table.** Appending to `xl/sharedStrings.xml` would
 * change a part every patch otherwise leaves byte for byte as EFRAG shipped it, and would oblige its two counts to be
 * kept; an inline string changes the written cell alone. Excel and LibreOffice both read it, and Excel moves it into
 * the shared table the next time a person saves the file.
 *
 * **A number Excel would alter is refused, not rounded.** More significant digits than a double holds would be
 * rounded silently when the file is opened — a figure differing from the platform's with nothing to say so. Rounding
 * is the export's, once, at the surface's precision (182/3); this package only refuses to round behind its back.
 */
export function cellBody(value: CellValue): CellBody {
  switch (value.kind) {
    case CELL_VALUE_KIND.NUMBER:
      return { type: null, children: `<v>${checkedNumber(value.value)}</v>` };
    case CELL_VALUE_KIND.TEXT:
      return { type: 'inlineStr', children: `<is><t xml:space="preserve">${escapeCellText(checkedText(value.value))}</t></is>` };
    case CELL_VALUE_KIND.BOOLEAN:
      return { type: 'b', children: `<v>${value.value ? 1 : 0}</v>` };
  }
}

function checkedNumber(decimal: string): string {
  if (!DECIMAL.test(decimal)) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.MALFORMED_NUMBER, `${JSON.stringify(decimal)} is not a plain decimal`);
  }
  const digits = decimal.replace(/[-.]/g, '').replace(/^0+/, '').replace(/0+$/, '');
  if (digits.length > MAX_SIGNIFICANT_DIGITS) {
    throw new XlsxPatchRefusedError(
      PATCH_REFUSAL.MALFORMED_NUMBER,
      `${decimal} has ${digits.length} significant digits; a cell holds ${MAX_SIGNIFICANT_DIGITS}`,
    );
  }
  return decimal;
}

function checkedText(text: string): string {
  if (!text.isWellFormed()) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.MALFORMED_TEXT, 'the text holds a lone surrogate');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new XlsxPatchRefusedError(
      PATCH_REFUSAL.MALFORMED_TEXT,
      `the text is ${text.length} characters long; a cell holds ${MAX_TEXT_LENGTH}`,
    );
  }
  return text;
}

/**
 * Text as SpreadsheetML's `ST_Xstring` writes it (ECMA-376 Part 1, §22.9.2.19), then escaped for XML.
 *
 * Three things a plain XML escape gets wrong, each of which would change what the reader sees:
 * - **A control character XML 1.0 cannot carry** is written `_xHHHH_`, the escape Excel decodes.
 * - **A carriage return** is written `_x000D_`, because an XML parser normalises a literal one to a line feed and a
 *   reporter's `\r\n` would read back as `\n`.
 * - **Text that already looks like an escape** — a literal `_x0041_` — has its underscore written `_x005F_`, or Excel
 *   would decode it to `A`.
 */
export function escapeCellText(text: string): string {
  const literalsKept = text.replace(/_x[0-9A-Fa-f]{4}_/g, (literal) => `_x005F${literal}`);
  const encoded = Array.from(literalsKept, (character) =>
    mustBeEncoded(character.charCodeAt(0)) ? `_x${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_` : character,
  ).join('');
  return escapeXml(encoded);
}

const TAB = 0x09;
const LINE_FEED = 0x0a;

/** The C0 controls but tab and line feed — carriage return included, for the reason above — and the two non-characters. */
const mustBeEncoded = (code: number): boolean =>
  (code < 0x20 && code !== TAB && code !== LINE_FEED) || code === 0xfffe || code === 0xffff;
