import { parseDecimalInput } from '@/lib/decimal-input';

/**
 * A figure as typed off a bill, read the way the wizard reads any number (`lib/decimal-input.ts`) — `1 700`, `1700,5`
 * — and **refused when negative**: no bill reads below zero, and the api refuses one (task 38.1's
 * `calc_source_quantity_non_negative`), so saying so at the field is the input mask the root `CLAUDE.md` lets a form
 * keep, not a business rule restated. Empty is `null`: the caller decides what an empty figure means where it is.
 */
export function readFigure(raw: string): { readonly value: string | null } | { readonly invalid: true } {
  const parsed = parseDecimalInput(raw);
  return 'value' in parsed && parsed.value !== null && parsed.value.startsWith('-') ? { invalid: true } : parsed;
}
