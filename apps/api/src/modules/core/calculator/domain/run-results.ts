import { addDecimals } from '@api/contracts/types/decimal';
import { B3_ELEMENT_FOR_SCOPE } from '../models/b3-element.model';
import type { CalcInput } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';
import { scope1 } from './scope-1';
import { scope2LocationBased } from './scope-2-location-based';
import type { ScopeTotal } from './scope-total';

/**
 * What a run computes from its retained inputs and its pinned set — Scope 1, then location-based Scope 2 (task 38.4;
 * FR-34, UC-33).
 *
 * **One function for the run and for its replay**, which is NFR-19's whole point: a recorded run's results and the
 * result of computing its retained inputs again against its own pinned set are the same call, so *reproduces* is a
 * comparison of two answers to one question rather than of two implementations.
 */
export function runResults(input: { readonly inputs: readonly CalcInput[]; readonly factorSet: FactorSet }): readonly ScopeTotal[] {
  return [scope1(input), scope2LocationBased(input)];
}

/** A run's results as the B3 figures they answer — what the run writes, and what it stores to be replayed against. */
export function resultFigures(
  scopes: readonly ScopeTotal[],
): readonly { readonly elementKey: string; readonly valueNumeric: string | null }[] {
  return scopes.map((scope) => ({ elementKey: B3_ELEMENT_FOR_SCOPE[scope.ghgScope], valueNumeric: scope.tonnesCo2e }));
}

/**
 * Whether a run reproduces (NFR-19): computing its retained inputs again against its pinned set gives exactly the
 * figures it stored. **Compared as numbers, not as spellings** — a `numeric` read back can carry trailing zeros the
 * computation never wrote — and **every figure must match**, including a scope that measured nothing on both sides.
 */
export function reproduces(input: {
  readonly stored: readonly { readonly elementKey: string; readonly tonnesCo2e: string | null }[];
  readonly recomputed: readonly { readonly elementKey: string; readonly valueNumeric: string | null }[];
}): boolean {
  const canonical = (value: string | null): string | null => (value === null ? null : addDecimals(value, '0'));
  const stored = new Map(input.stored.map((figure) => [figure.elementKey, canonical(figure.tonnesCo2e)]));
  if (stored.size !== input.recomputed.length) return false;
  return input.recomputed.every(
    (figure) => stored.has(figure.elementKey) && stored.get(figure.elementKey) === canonical(figure.valueNumeric),
  );
}
