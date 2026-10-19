import type { useFormatter } from 'next-intl';

/**
 * A decimal as a reader types it and as they read it back: read by the interface language's own marks into the
 * canonical string the wire carries (NFR-58: a decimal as a string, never a float), and the canonical string laid out
 * again in the reader's format (UX-96).
 *
 * **In `lib/` since task 39.1**, when S-09's invoice figures became its second reader beside S-07's numeric fields — two
 * features, one reading of what a reader typed, so a figure accepted on one screen is never refused on the other for its
 * punctuation.
 *
 * **Read by the language's marks since task 220** (`architecture.md` §12.5.6's task-220 row). Until then a space was the
 * only thousands mark and a dot or a comma the decimal, in every language — while Romanian groups thousands with a dot
 * (`1.234.567,5`, as the browser lays it out), so `1.240` typed in Romanian was stored as 1,24, a thousandfold error said
 * nowhere. Now:
 *
 * - a space (any width) is a thousands mark in every language;
 * - the language's decimal mark is always the decimal — `1,240` in Romanian is 1,24;
 * - both marks present make the last one the decimal and the other the thousands mark — `1.240,50`, `1,240.50`;
 * - a mark repeated is the thousands mark — `1.240.000`;
 * - a thousands mark stands only between groups of three, the first group one to three digits and not led by a zero;
 * - **one mark that is not the language's decimal, with one to three digits before it and exactly three after, reads
 *   two ways** — `1.240` in Romanian or Russian, `12,400` in English — and the answer is both readings, for the caller
 *   to ask which was meant, the decimal one without its trailing zeros. Any other count of digits after it makes it the decimal: `1.5` in Romanian is 1,5.
 *
 * Field-level reading with no business meaning, which is what may live in the form (root `CLAUDE.md`). What is refused is
 * anything that is not a number — letters, a sign alone, a thousands mark out of place — because the column is `numeric`
 * and the database would refuse it with a message no reader can act on.
 *
 * **The answer is the canonical spelling, not the typed one** (task 204.2): no leading zero before a digit and no bare
 * point — `0500` is `500`, `12,` is `12`, `,5` is `0.5`. The api's own reading (`isDecimalString`) refuses the typed
 * spellings, so the reader of a figure is where the spelling is settled — once, for every screen that reads one, and for
 * an imported spreadsheet's text cells.
 *
 * Empty is a legitimate answer here: it means *clear the field*, which the caller writes as a `missing` state rather
 * than as a value.
 *
 * **The language's marks are its formatter's**, never a table here: the decimal mark is the one `format.number` writes,
 * and the grouping is the named `integer` format's (`i18n/formats.ts`), so the reading and the layout cannot disagree
 * with every other number the reader sees (NFR-26).
 */
type Formatter = Pick<ReturnType<typeof useFormatter>, 'number'>;

export type DecimalReading =
  | { readonly value: string | null }
  | { readonly invalid: true }
  /** Both readings, canonical: the mark as the thousands mark, and as the decimal. */
  | { readonly ambiguous: { readonly thousands: string; readonly decimal: string } };

const DOT = '.';
const COMMA = ',';
const MINUS = '-';
const NUMBER_TEXT = /^(-?)([\d.,]+)$/u;
/** The digits a single mark may follow and still be a thousands mark: one group, not led by a zero. */
const FIRST_GROUP = /^[1-9]\d{0,2}$/u;
const ONE_GROUP = /^\d{3}$/u;
const CANONICAL = /^(-?)(\d+)(?:\.(\d+))?$/u;

export function parseDecimalInput(input: { readonly raw: string; readonly format: Formatter }): DecimalReading {
  const compact = input.raw.replace(/\s/gu, '');
  if (compact === '') return { value: null };
  const match = NUMBER_TEXT.exec(compact);
  if (match === null) return { invalid: true };
  const [, sign, body] = match;
  const dots = countOf(body, DOT);
  const commas = countOf(body, COMMA);

  if (dots > 0 && commas > 0) {
    const decimal = body.lastIndexOf(DOT) > body.lastIndexOf(COMMA) ? DOT : COMMA;
    if (countOf(body, decimal) !== 1) return { invalid: true };
    const at = body.indexOf(decimal);
    const whole = ungrouped({ text: body.slice(0, at), mark: decimal === DOT ? COMMA : DOT });
    return whole === null ? { invalid: true } : read({ sign, whole, fraction: body.slice(at + 1) });
  }
  if (dots + commas > 1) {
    const whole = ungrouped({ text: body, mark: dots > 0 ? DOT : COMMA });
    return whole === null ? { invalid: true } : read({ sign, whole, fraction: '' });
  }
  if (dots + commas === 0) return read({ sign, whole: body, fraction: '' });

  const mark = dots > 0 ? DOT : COMMA;
  const [whole, fraction] = body.split(mark);
  if (mark !== decimalMarkOf(input.format) && FIRST_GROUP.test(whole) && ONE_GROUP.test(fraction)) {
    const thousands = read({ sign, whole: `${whole}${fraction}`, fraction: '' });
    // **Without its trailing zeros**, so the two answers differ by more than the mark in question: `1.240` offers
    // *1.240* and *1,24*, never *1,240* beside it.
    const decimal = read({ sign, whole, fraction: fraction.replace(/0+$/u, '') });
    if ('value' in thousands && 'value' in decimal && thousands.value !== null && decimal.value !== null) {
      return { ambiguous: { thousands: thousands.value, decimal: decimal.value } };
    }
  }
  return read({ sign, whole, fraction });
}

/**
 * A stored decimal as the reader reads it — grouped by the language, its fraction exactly as stored (task 220; UX-96).
 * **Laid out by its digits, never through a float**: the whole part through the named `integer` format over a `BigInt`,
 * so a figure typed `1240,50` reads `1.240,50` in Romanian and no digit past a double's fifteenth is invented. A typed
 * figure is an answer, not a computation (§12.5.6's task-211 row), so nothing here rounds. A string that is not a
 * canonical decimal is returned as it is.
 */
export function decimalForReading(input: { readonly value: string; readonly format: Formatter }): string {
  const parts = CANONICAL.exec(input.value);
  if (parts === null) return input.value;
  const [, sign, whole, fraction] = parts;
  const grouped = input.format.number(BigInt(whole), 'integer');
  return `${sign === '' ? '' : MINUS}${grouped}${fraction === undefined ? '' : `${decimalMarkOf(input.format)}${fraction}`}`;
}

/**
 * A stored decimal as the reader edits it — the language's decimal mark and **no thousands mark** (task 220), so the
 * text being edited never holds a mark that could read two ways when it is read again. A string that is not a canonical
 * decimal is returned as it is.
 */
export function decimalForEditing(input: { readonly value: string; readonly format: Formatter }): string {
  const parts = CANONICAL.exec(input.value);
  if (parts === null) return input.value;
  const [, sign, whole, fraction] = parts;
  return `${sign === '' ? '' : MINUS}${whole}${fraction === undefined ? '' : `${decimalMarkOf(input.format)}${fraction}`}`;
}

/** The canonical spelling of a sign, a whole part and a fraction, or the refusal of a number with no digit at all. */
function read(input: { readonly sign: string; readonly whole: string; readonly fraction: string }): DecimalReading {
  if (input.whole === '' && input.fraction === '') return { invalid: true };
  const digits = `${input.whole.replace(/^0+(?=\d)/u, '') || '0'}${input.fraction === '' ? '' : `.${input.fraction}`}`;
  // A zero has no sign: `-0` is the reader's zero, and the wire has one spelling of it.
  return { value: /[1-9]/u.test(digits) ? `${input.sign}${digits}` : digits };
}

/** The whole part with its thousands marks taken out, or `null` where a mark does not stand between groups of three. */
function ungrouped(input: { readonly text: string; readonly mark: string }): string | null {
  const groups = input.text.split(input.mark);
  const [first, ...rest] = groups;
  return FIRST_GROUP.test(first) && rest.length > 0 && rest.every((group) => ONE_GROUP.test(group))
    ? groups.join('')
    : null;
}

function countOf(text: string, mark: string): number {
  return text.split(mark).length - 1;
}

/**
 * The language's decimal mark, as its own number format writes it — `,` in Romanian and Russian, `.` in English: what is
 * left of *one and a half* once its digits are taken out.
 */
function decimalMarkOf(format: Formatter): string {
  return format.number(1.5).replace(/\d/gu, '');
}
