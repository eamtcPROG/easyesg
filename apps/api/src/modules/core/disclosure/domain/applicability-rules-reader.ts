import {
  APPLICABILITY_CONDITION,
  type ApplicabilityConditionSpec,
  type ApplicabilityRule,
} from '../models/applicability.model';
import { isDecimalText } from './applicability';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string');

/**
 * A `disclosure_applicability` payload read (tasks 91.3, 67.8) — the rules it holds, and the index of each it could not
 * read. **Pure, and shared by three readers**: the wizard's rules in force (`ApplicabilityRulesService`, which logs the
 * dropped and fails open), the publication rule that refuses a payload with any rule unreadable (A-05, so an operator
 * never publishes a rule the wizard would drop), and a threshold change's notice, which reads the revision leaving and
 * the one entering. `null` where the payload holds no list of rules at all.
 */
export function readApplicabilityRules(
  payload: unknown,
): { readonly rules: readonly ApplicabilityRule[]; readonly dropped: readonly number[] } | null {
  const listed = isRecord(payload) ? payload.rules : undefined;
  if (!Array.isArray(listed)) return null;

  const rules: ApplicabilityRule[] = [];
  const dropped: number[] = [];
  listed.forEach((rule: unknown, index) => {
    const condition = isRecord(rule) && isNonEmptyStringArray(rule.elements) ? readCondition(rule.condition) : null;
    if (condition === null || !isRecord(rule) || !isNonEmptyStringArray(rule.elements)) {
      dropped.push(index);
      return;
    }
    rules.push({ elements: rule.elements, condition });
  });
  return { rules, dropped };
}

/** The publication rule (task 67.8): a payload with no rule list, or with any rule the reader would drop, is refused. */
export function applicabilityRefusal(payload: unknown): string | null {
  const read = readApplicabilityRules(payload);
  if (read === null) return 'lists no rules';
  return read.dropped.length === 0 ? null : `rule ${read.dropped.map((index) => index + 1).join(', ')} is unreadable`;
}

/** One condition, narrowed to those the vocabulary declares; `null` for anything else. */
function readCondition(condition: unknown): ApplicabilityConditionSpec | null {
  if (!isRecord(condition)) return null;
  switch (condition.kind) {
    case APPLICABILITY_CONDITION.NUMERIC_AT_LEAST:
      // A threshold the comparison cannot read is a malformed rule, not a rule nothing satisfies: dropped here, its
      // elements stay applicable — where treating it as unmet would hide them.
      return typeof condition.elementKey === 'string' && isDecimalText(condition.threshold)
        ? { kind: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST, elementKey: condition.elementKey, threshold: condition.threshold }
        : null;
    case APPLICABILITY_CONDITION.ANY_ROW_ANSWERED:
      return isNonEmptyStringArray(condition.elementKeys)
        ? { kind: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED, elementKeys: condition.elementKeys }
        : null;
    case APPLICABILITY_CONDITION.MEMBER_WITHIN:
      return typeof condition.elementKey === 'string' && isNonEmptyStringArray(condition.members)
        ? { kind: APPLICABILITY_CONDITION.MEMBER_WITHIN, elementKey: condition.elementKey, members: condition.members }
        : null;
    case APPLICABILITY_CONDITION.IS_TRUE:
      return typeof condition.elementKey === 'string' && condition.elementKey !== ''
        ? { kind: APPLICABILITY_CONDITION.IS_TRUE, elementKey: condition.elementKey }
        : null;
    default:
      return null;
  }
}
