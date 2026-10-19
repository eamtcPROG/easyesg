import { parseDecimalInput, type DecimalReading } from '@/lib/decimal-input';

type Formatter = Parameters<typeof parseDecimalInput>[0]['format'];

const NEGATIVE = /^-/u;

/**
 * A figure as typed off a bill, read the way the wizard reads any number (`lib/decimal-input.ts`) — by the language's own
 * marks, `1.700` asked about in Romanian, `1700,5` — and **refused when negative**: no bill reads below zero, and the api
 * refuses one (task 38.1's `calc_source_quantity_non_negative`), so saying so at the field is the input mask the root
 * `CLAUDE.md` lets a form keep, not a business rule restated. A text that reads two ways below zero is refused too, since
 * neither reading could be stored. Empty is `null`: the caller decides what an empty figure means where it is.
 */
export function readFigure(input: { readonly raw: string; readonly format: Formatter }): DecimalReading {
  const read = parseDecimalInput(input);
  if ('ambiguous' in read) return NEGATIVE.test(read.ambiguous.thousands) ? { invalid: true } : read;
  return 'value' in read && read.value !== null && NEGATIVE.test(read.value) ? { invalid: true } : read;
}
