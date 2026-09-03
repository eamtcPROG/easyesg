import {
  APPLICABILITY_CONDITION,
  type ApplicabilityCause,
  type ApplicabilityConditionSpec,
  type ApplicabilityRule,
  type EvaluatedApplicability,
} from '../models/applicability.model';
import { isAnsweredState, type DisclosureValue } from '../models/disclosure-value.model';

/**
 * FR-28's conditional applicability, evaluated (task 91.3; BR-APP-1 … BR-APP-5).
 *
 * **Pure, and framework-free by rule** — no store, no registry, no `Logger`. Everything it needs is
 * data the caller already holds: the rules from configuration, the report's own stored answers, and
 * the ancestry of the classifications the rules name. So every threshold either side of its boundary
 * is a unit case with no database, which is what the dependency rule buys.
 *
 * **Only governed elements appear in the result.** A rule says what makes a field *apply*; an
 * element no rule names is applicable with no cause, and the caller defaults to that rather than
 * this function returning 143 entries saying so.
 */

/**
 * Qualified member → its qualified parent, `null` at a root — the classification's own hierarchy,
 * flattened for the one question `member_within` asks.
 *
 * The caller builds it from the registry because only that tier can (task 91.3): the domains are
 * `TaxonomyEnumeration`s of the report's own pinned version, and resolving them here would make a
 * pure function depend on a port.
 */
export type MemberAncestry = ReadonlyMap<string, string | null>;

export interface ApplicabilityInput {
  readonly rules: readonly ApplicabilityRule[];
  /** Every stored value of the report, indexed by element key — the read already holds this. */
  readonly answers: ReadonlyMap<string, readonly DisclosureValue[]>;
  /** Covering every domain a `member_within` rule names; empty where none does. */
  readonly ancestry: MemberAncestry;
}

/**
 * How deep a classification may nest before the walk gives up.
 *
 * NACE is four levels and the EU List of Waste three, so this is not a limit any real member meets
 * — it is what stops a cycle in externally-published data from hanging a request. A `parent` chain
 * is data an operator can publish, and *"the artefact is well-formed"* is not a property this tier
 * can assume of it.
 */
const MAX_ANCESTRY_DEPTH = 16;

/**
 * The one cause a set of verdicts agrees on, or `undefined` where they do not (task 91.3).
 *
 * What a module announces when every element in it has gone: UX-27 asks for *the* cause, so a
 * module its elements left for two different reasons has none to give and says nothing rather than
 * naming one of them. Two verdicts are the same reason when the condition, its drivers, its
 * threshold and the answer all agree.
 *
 * **Here rather than inside the read**, so the disagreement branch is reachable by a unit case: the
 * four shipped rules never put two of them over one module, and a check only the shipped artefact
 * can reach is a check that never runs (found by the gate-integrity review, 3 Sep 2026).
 */
export function soleCause(
  verdicts: readonly EvaluatedApplicability[],
): EvaluatedApplicability | undefined {
  const distinct = new Map<string, EvaluatedApplicability>();
  for (const verdict of verdicts) {
    const { cause } = verdict;
    distinct.set(
      [cause.condition, cause.driverKeys.join(','), cause.threshold, cause.answer].join('\u0000'),
      verdict,
    );
  }
  return distinct.size === 1 ? distinct.values().next().value : undefined;
}

export function evaluateApplicability(
  input: ApplicabilityInput,
): ReadonlyMap<string, EvaluatedApplicability> {
  const evaluated = new Map<string, EvaluatedApplicability>();

  for (const rule of input.rules) {
    const verdict = evaluate(rule.condition, input);
    for (const elementKey of rule.elements) {
      const standing = evaluated.get(elementKey);
      // Two rules over one element is a conjunction — the field applies when every one of them
      // holds — and the cause reported is the one that refuses it. Nothing in FR-28's four
      // overlaps today; stating the rule here is cheaper than discovering it from a fifth.
      if (standing === undefined || (standing.applicable && !verdict.applicable)) {
        evaluated.set(elementKey, verdict);
      }
    }
  }
  return evaluated;
}

function evaluate(
  condition: ApplicabilityConditionSpec,
  input: ApplicabilityInput,
): EvaluatedApplicability {
  switch (condition.kind) {
    case APPLICABILITY_CONDITION.NUMERIC_AT_LEAST: {
      const answer = answeredRow(input.answers, condition.elementKey)?.valueNumeric ?? null;
      return {
        applicable: answer !== null && atLeast({ value: answer, threshold: condition.threshold }),
        cause: cause(condition, { driverKeys: [condition.elementKey], threshold: condition.threshold, answer }),
      };
    }
    case APPLICABILITY_CONDITION.ANY_ROW_ANSWERED: {
      const applicable = condition.elementKeys.some(
        (elementKey) => answeredRow(input.answers, elementKey) !== undefined,
      );
      // No `answer`: the condition asks whether rows exist, and there is no single stored value to
      // quote back. `applicable` is what separates "sites are listed" from "none are".
      return {
        applicable,
        cause: cause(condition, { driverKeys: condition.elementKeys, threshold: null, answer: null }),
      };
    }
    case APPLICABILITY_CONDITION.MEMBER_WITHIN: {
      const answer = answeredRow(input.answers, condition.elementKey)?.valueText ?? null;
      return {
        applicable: answer !== null && withinAny(answer, condition.members, input.ancestry),
        cause: cause(condition, { driverKeys: [condition.elementKey], threshold: null, answer }),
      };
    }
  }
}

const cause = (
  condition: ApplicabilityConditionSpec,
  parts: Omit<ApplicabilityCause, 'condition'>,
): ApplicabilityCause => ({ condition: condition.kind, ...parts });

/**
 * The first answered row of an element, or `undefined` where none is.
 *
 * *First answered*, not first: a repeating group whose opening row was cleared still has sites in
 * it, and the drivers FR-28 names are undimensioned anyway, so this only ever chooses among rows
 * for the site rule — where "any row" is precisely the question.
 */
const answeredRow = (
  answers: ReadonlyMap<string, readonly DisclosureValue[]>,
  elementKey: string,
): DisclosureValue | undefined =>
  (answers.get(elementKey) ?? []).find((value) => isAnsweredState(value.state));

/**
 * Is the stored answer one of the rule's members, or below one?
 *
 * An `enumeration_set` answer is space-separated (task 91.1), and **any** member satisfying the
 * rule satisfies it: an undertaking that both manufactures and retails reports water for the half
 * that needs it.
 */
function withinAny(
  answer: string,
  members: readonly string[],
  ancestry: MemberAncestry,
): boolean {
  const wanted = new Set(members);
  return answer
    .split(/\s+/)
    .filter((member) => member.length > 0)
    .some((member) => {
      let current: string | null = member;
      for (let depth = 0; current !== null && depth < MAX_ANCESTRY_DEPTH; depth += 1) {
        if (wanted.has(current)) return true;
        current = ancestry.get(current) ?? null;
      }
      return false;
    });
}

/**
 * `value >= threshold` over two decimal strings, **without either becoming a float** (NFR-58).
 *
 * A headcount compared through `Number` would be right for every value this rule will ever meet,
 * and wrong for the reason NFR-58 exists: the same helper is the one a factor set or a monetary
 * threshold reaches for next, and a comparison that silently rounds is not discoverable from its
 * call site. Scaling both sides to a common number of decimal places and comparing as `bigint` is
 * exact at any magnitude.
 *
 * **Named fields, because both sides are `string` and adjacent** (CLAUDE.md): swapped, the
 * comparison inverts, returns a perfectly good boolean, and hides a disclosure that applies — which
 * this task's own §12.5.6 row calls the expensive direction of the error.
 *
 * An unparseable **stored value** does not satisfy the threshold — a field in `error` for task 41 to
 * report, which must not decide applicability by accident. An unparseable **threshold** never
 * reaches here: `isDecimalText` is what the rule reader admits a condition on, so a malformed one is
 * a dropped rule whose elements stay applicable, which is the fail-open direction §12.5.6 records.
 */
function atLeast(input: { readonly value: string; readonly threshold: string }): boolean {
  const left = scaled(input.value);
  const right = scaled(input.threshold);
  if (left === null || right === null) return false;
  const scale = Math.max(left.scale, right.scale);
  return (
    left.units * 10n ** BigInt(scale - left.scale) >= right.units * 10n ** BigInt(scale - right.scale)
  );
}

/**
 * A decimal as text: optional minus, digits, optional fraction (NFR-58).
 *
 * No leading `+`, so the capture composes straight into a `BigInt` literal with nothing to compare
 * a sign character against — and Postgres renders `numeric` without one, so nothing this reads
 * carries it.
 */
const DECIMAL = /^\s*(-?\d+)(?:\.(\d+))?\s*$/;

/**
 * Is this text a decimal? **Exported beside the pattern that answers it**, so the rule reader
 * admits exactly the thresholds `atLeast` can compare — one regex with two readers rather than two
 * that drift, and the operation living with what it operates on (CLAUDE.md).
 */
export const isDecimalText = (text: unknown): text is string =>
  typeof text === 'string' && DECIMAL.test(text);

function scaled(text: string): { units: bigint; scale: number } | null {
  const match = DECIMAL.exec(text);
  if (match === null) return null;
  const [, whole, fraction = ''] = match;
  return { units: BigInt(`${whole}${fraction}`), scale: fraction.length };
}
