import { isAnswered, isDeclaredUnavailable, type FieldAddress, type FieldValue, type Finding } from '@easyesg/validation';
import type { Counts, ModuleRollUp, RollUp } from '../models/roll-up.model';

/** What a counted field counts as — one of the three counts, by name. Internal to this file. */
const OUTCOME = {
  RESOLVED: 'resolved',
  REASONED: 'reasoned',
  OUTSTANDING: 'outstanding',
} as const satisfies Record<string, keyof Counts>;

type Outcome = (typeof OUTCOME)[keyof typeof OUTCOME];

/**
 * UC-38's single readiness signal, computed by a run from what it read and what it found (task 41.3; FR-41; §12.5.6's
 * task-182 validation row, 182/18, and task-41 row (h)).
 *
 * **What is counted**: every field in the report's scope that the run found answered or that carries a finding —
 * *outstanding* where a finding sits on it, else *reasoned* where it was declared not available (FR-32), else
 * *resolved*. An unanswered field no rule flags is not counted, as the template's own roll-up skips a status of `-`: an
 * optional question left blank is nothing to do.
 *
 * **Where**: in each module its element counts in — an element B3 and C3 share counts in both — and once in the report,
 * by its address. Every module the caller lists is listed, in its order, one nothing has touched — or one waiting on
 * B1 — with zero counts.
 *
 * Pure, so every count is a unit case.
 */
export function rollUp(input: {
  readonly scope: ReadonlyMap<string, readonly string[]>;
  /** The modules to list, in the order to list them — every module owed, a waiting one included (FR-41 item 2). */
  readonly modules: readonly string[];
  readonly values: readonly FieldValue[];
  readonly findings: readonly Finding[];
}): RollUp {
  /** Every counted field once, by its address — a finding's first, so a field with one is outstanding. */
  const fields = new Map<string, { readonly address: FieldAddress; readonly outcome: Outcome }>();
  for (const finding of input.findings) fields.set(keyOf(finding.field), { address: finding.field, outcome: OUTCOME.OUTSTANDING });
  for (const value of input.values) {
    if (!input.scope.has(value.elementKey) || !isAnswered(value)) continue;
    const address = { elementKey: value.elementKey, dimensionKey: value.dimensionKey ?? '', ordinal: value.ordinal ?? 0 };
    if (fields.has(keyOf(address))) continue;
    fields.set(keyOf(address), { address, outcome: isDeclaredUnavailable(value) ? OUTCOME.REASONED : OUTCOME.RESOLVED });
  }

  const modules = new Map<string, { counts: Record<Outcome, number>; outstandingFields: FieldAddress[] }>();
  for (const module of input.modules) modules.set(module, { counts: zero(), outstandingFields: [] });
  const report = zero();
  for (const { address, outcome } of fields.values()) {
    report[outcome] += 1;
    for (const module of input.scope.get(address.elementKey) ?? []) {
      const entry = modules.get(module);
      if (entry === undefined) continue;
      entry.counts[outcome] += 1;
      if (outcome === OUTCOME.OUTSTANDING) entry.outstandingFields.push(address);
    }
  }
  return {
    report,
    modules: [...modules].map(
      ([module, entry]): ModuleRollUp => ({ module, ...entry.counts, outstandingFields: entry.outstandingFields }),
    ),
  };
}

const zero = (): Record<Outcome, number> => ({ resolved: 0, reasoned: 0, outstanding: 0 });

const keyOf = (address: FieldAddress): string =>
  `${address.elementKey}\u0000${address.dimensionKey}\u0000${address.ordinal}`;

