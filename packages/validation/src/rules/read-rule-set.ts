import { compareDecimals, isDecimalText, readDecimal } from './decimal.js';
import {
  ADMITTED_VERDICTS,
  CONDITION_KIND,
  RELATION,
  RULE_KIND,
  type Condition,
  type FieldSelector,
  type Relation,
  type Rule,
  type RuleKind,
  type RuleSet,
  type SumPart,
} from './rule-definition.js';

/**
 * A configuration payload read as a rule set, or refused with every problem named (task 40.1; FR-73).
 *
 * **One reader, before anything trusts a payload**: task 41.1 reads what the store holds through it, and A-05 (task
 * 67.8) refuses a publication through it — so a rule the interpreter cannot hold is stopped where an operator can
 * correct it rather than met at evaluation, and the two callers cannot accept different sets. It refuses what the
 * vocabulary cannot hold: an unknown kind, a verdict the kind does not admit, a property the kind does not have, a
 * bound that is not a decimal, a second year-over-year rule (182/28: one proportion). Whether a message key has
 * wording in every locale (FR-73 item 8) and whether an element exists in a taxonomy version are not this reader's:
 * both need what only the api holds.
 *
 * **The rules it returns are rebuilt from the properties it read**, never the payload passed through, so nothing it
 * did not check reaches the interpreter.
 */
export const RULE_SET_READ = {
  READ: 'read',
  REFUSED: 'refused',
} as const;

/** What is wrong, as a code A-05 words in the operator's language — never a sentence here (OQ-43). */
export const RULE_PROBLEM = {
  /** The payload is not `{ rules: [...] }`. */
  NOT_A_RULE_SET: 'not_a_rule_set',
  NOT_A_RULE: 'not_a_rule',
  MISSING_ID: 'missing_id',
  DUPLICATE_ID: 'duplicate_id',
  UNKNOWN_KIND: 'unknown_kind',
  /** No message key, or one that is not dot-separated words. */
  MISSING_MESSAGE: 'missing_message',
  VERDICT_NOT_ADMITTED: 'verdict_not_admitted',
  /** A property this kind does not have — a `when` on a sum, say. */
  UNEXPECTED_PROPERTY: 'unexpected_property',
  /** The fields, elements, parts or total are absent, empty, or not named by an element and an optional member. */
  MALFORMED_FIELDS: 'malformed_fields',
  MALFORMED_CONDITION: 'malformed_condition',
  UNKNOWN_RELATION: 'unknown_relation',
  /** A weight, bound or proportion that is not a decimal, a weight of zero, or a proportion that is not positive. */
  MALFORMED_NUMBER: 'malformed_number',
  /** A range with no bound, or with its minimum above its maximum. */
  EMPTY_RANGE: 'empty_range',
  /** 182/28: one global proportion, so one year-over-year rule per set. */
  SECOND_YEAR_OVER_YEAR: 'second_year_over_year',
} as const;

export type RuleProblemCode = (typeof RULE_PROBLEM)[keyof typeof RULE_PROBLEM];

export interface RuleProblem {
  /** The rule's position in the set, `null` for a problem with the set itself. */
  readonly index: number | null;
  /** The rule's id where it has a readable one. */
  readonly id: string | null;
  readonly problem: RuleProblemCode;
}

export type RuleSetReading =
  | { readonly outcome: typeof RULE_SET_READ.READ; readonly ruleSet: RuleSet }
  | { readonly outcome: typeof RULE_SET_READ.REFUSED; readonly problems: readonly RuleProblem[] };

type Raw = Readonly<Record<string, unknown>>;

/** A rule read, or what stops it. */
type Reading = { readonly rule: Rule } | { readonly problems: readonly RuleProblemCode[] };

/** The properties every rule shares, already read: a kind's reader adds its own. */
interface Core {
  readonly id: string;
  readonly message: string;
  readonly raw: Raw;
}

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isName = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** A catalogue key: dot-separated words, as every catalogue in the repository writes them. */
const MESSAGE_KEY = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/u;

const KINDS: ReadonlySet<string> = new Set(Object.values(RULE_KIND));
const isRuleKind = (value: unknown): value is RuleKind => typeof value === 'string' && KINDS.has(value);

const RELATIONS: ReadonlySet<string> = new Set(Object.values(RELATION));
const isRelation = (value: unknown): value is Relation => typeof value === 'string' && RELATIONS.has(value);

/** The properties each kind adds to the four every rule has — anything else is refused. */
const COMMON = ['id', 'kind', 'verdict', 'message'];
const PROPERTIES: Readonly<Record<RuleKind, readonly string[]>> = {
  [RULE_KIND.REQUIRED]: ['fields', 'when'],
  [RULE_KIND.REQUIRED_ANY]: ['fields', 'when'],
  [RULE_KIND.ROW_COMPLETE]: ['elements'],
  [RULE_KIND.SUM]: ['parts', 'total', 'relation'],
  [RULE_KIND.RANGE]: ['fields', 'min', 'max'],
  [RULE_KIND.URL]: ['fields'],
  [RULE_KIND.EXCLUSIVE]: ['when', 'empty'],
  [RULE_KIND.YEAR_OVER_YEAR]: ['proportion'],
};

const onlyHas = (raw: Raw, allowed: readonly string[]): boolean =>
  Object.keys(raw).every((key) => allowed.includes(key));

/** The problems among a list of checks — each `false` where its check passed. */
const codes = (...checks: readonly (RuleProblemCode | false)[]): readonly RuleProblemCode[] =>
  checks.filter((check): check is RuleProblemCode => check !== false);

const refused = (...checks: readonly (RuleProblemCode | false)[]): Reading => ({ problems: codes(...checks) });

function readSelector(raw: unknown, extra: readonly string[] = []): FieldSelector | null {
  if (!isRecord(raw) || !onlyHas(raw, ['element', 'member', ...extra]) || !isName(raw.element)) return null;
  if (raw.member === undefined) return { element: raw.element };
  return isName(raw.member) ? { element: raw.element, member: raw.member } : null;
}

function readSelectors(raw: unknown): readonly FieldSelector[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const selectors = raw.map((entry: unknown) => readSelector(entry));
  return selectors.every((selector) => selector !== null) ? selectors : null;
}

function readElements(raw: unknown): readonly string[] | null {
  return Array.isArray(raw) && raw.length > 0 && raw.every(isName) ? raw : null;
}

function readCondition(raw: unknown): Condition | null {
  if (!isRecord(raw) || !onlyHas(raw, ['kind', 'element']) || !isName(raw.element)) return null;
  if (raw.kind === CONDITION_KIND.ANSWERED) return { kind: CONDITION_KIND.ANSWERED, element: raw.element };
  if (raw.kind === CONDITION_KIND.IS_TRUE) return { kind: CONDITION_KIND.IS_TRUE, element: raw.element };
  return null;
}

/** A part's weight: absent, or a decimal other than zero. */
const weightIsReadable = (weight: unknown): boolean => {
  if (weight === undefined) return true;
  const value = typeof weight === 'string' ? readDecimal(weight) : null;
  return value !== null && value.units !== 0n;
};

function readPart(raw: unknown): SumPart | null {
  const selector = readSelector(raw, ['weight']);
  if (selector === null || !isRecord(raw) || typeof raw.weight !== 'string') return selector;
  return { ...selector, weight: raw.weight };
}

/** A bound's text where it is a decimal; `undefined` where it is absent, `null` where it is present and malformed. */
function readBound(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' && isDecimalText(raw) ? raw : null;
}

/** `required` and `required_any` read alike: a list of fields and an optional condition. */
function readPresence(core: Core): { readonly fields: readonly FieldSelector[]; readonly when?: Condition } | null {
  const fields = readSelectors(core.raw.fields);
  const when = core.raw.when === undefined ? undefined : readCondition(core.raw.when);
  if (fields === null || when === null) return null;
  return when === undefined ? { fields } : { fields, when };
}

const presenceProblems = (core: Core): Reading =>
  refused(
    readSelectors(core.raw.fields) === null && RULE_PROBLEM.MALFORMED_FIELDS,
    core.raw.when !== undefined && readCondition(core.raw.when) === null && RULE_PROBLEM.MALFORMED_CONDITION,
  );

function readRequired(core: Core): Reading {
  const presence = readPresence(core);
  const verdict = ADMITTED_VERDICTS[RULE_KIND.REQUIRED].find((admitted) => admitted === core.raw.verdict);
  if (presence === null || verdict === undefined) return presenceProblems(core);
  return { rule: { id: core.id, kind: RULE_KIND.REQUIRED, verdict, message: core.message, ...presence } };
}

function readRequiredAny(core: Core): Reading {
  const presence = readPresence(core);
  const verdict = ADMITTED_VERDICTS[RULE_KIND.REQUIRED_ANY].find((admitted) => admitted === core.raw.verdict);
  if (presence === null || verdict === undefined) return presenceProblems(core);
  return { rule: { id: core.id, kind: RULE_KIND.REQUIRED_ANY, verdict, message: core.message, ...presence } };
}

function readRowComplete(core: Core): Reading {
  const elements = readElements(core.raw.elements);
  const verdict = ADMITTED_VERDICTS[RULE_KIND.ROW_COMPLETE].find((admitted) => admitted === core.raw.verdict);
  if (elements === null || verdict === undefined) return refused(elements === null && RULE_PROBLEM.MALFORMED_FIELDS);
  return { rule: { id: core.id, kind: RULE_KIND.ROW_COMPLETE, verdict, message: core.message, elements } };
}

function readSum(core: Core): Reading {
  const rawParts: readonly unknown[] = Array.isArray(core.raw.parts) ? core.raw.parts : [];
  const parts = rawParts.map(readPart);
  const total = readSelector(core.raw.total);
  const relation = core.raw.relation;
  const weights = rawParts.every((part) => !isRecord(part) || weightIsReadable(part.weight));
  const verdict = ADMITTED_VERDICTS[RULE_KIND.SUM].find((admitted) => admitted === core.raw.verdict);
  const shaped = parts.length > 0 && parts.every((part) => part !== null) && total !== null;
  if (!shaped || !weights || !isRelation(relation) || verdict === undefined) {
    return refused(
      !shaped && RULE_PROBLEM.MALFORMED_FIELDS,
      !weights && RULE_PROBLEM.MALFORMED_NUMBER,
      !isRelation(relation) && RULE_PROBLEM.UNKNOWN_RELATION,
    );
  }
  return {
    rule: {
      id: core.id,
      kind: RULE_KIND.SUM,
      verdict,
      message: core.message,
      parts: parts.filter((part) => part !== null),
      total,
      relation,
    },
  };
}

function readRange(core: Core): Reading {
  const fields = readSelectors(core.raw.fields);
  const min = readBound(core.raw.min);
  const max = readBound(core.raw.max);
  const lower = typeof min === 'string' ? readDecimal(min) : null;
  const upper = typeof max === 'string' ? readDecimal(max) : null;
  const malformed = min === null || max === null;
  const empty =
    !malformed &&
    ((min === undefined && max === undefined) ||
      (lower !== null && upper !== null && compareDecimals(lower, upper) > 0));
  const verdict = ADMITTED_VERDICTS[RULE_KIND.RANGE].find((admitted) => admitted === core.raw.verdict);
  if (fields === null || min === null || max === null || empty || verdict === undefined) {
    return refused(
      fields === null && RULE_PROBLEM.MALFORMED_FIELDS,
      malformed && RULE_PROBLEM.MALFORMED_NUMBER,
      empty && RULE_PROBLEM.EMPTY_RANGE,
    );
  }
  return {
    rule: {
      id: core.id,
      kind: RULE_KIND.RANGE,
      verdict,
      message: core.message,
      fields,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
    },
  };
}

function readUrl(core: Core): Reading {
  const fields = readSelectors(core.raw.fields);
  const verdict = ADMITTED_VERDICTS[RULE_KIND.URL].find((admitted) => admitted === core.raw.verdict);
  if (fields === null || verdict === undefined) return refused(fields === null && RULE_PROBLEM.MALFORMED_FIELDS);
  return { rule: { id: core.id, kind: RULE_KIND.URL, verdict, message: core.message, fields } };
}

function readExclusive(core: Core): Reading {
  const when = readCondition(core.raw.when);
  const empty = readElements(core.raw.empty);
  const verdict = ADMITTED_VERDICTS[RULE_KIND.EXCLUSIVE].find((admitted) => admitted === core.raw.verdict);
  if (when === null || empty === null || verdict === undefined) {
    return refused(when === null && RULE_PROBLEM.MALFORMED_CONDITION, empty === null && RULE_PROBLEM.MALFORMED_FIELDS);
  }
  return { rule: { id: core.id, kind: RULE_KIND.EXCLUSIVE, verdict, message: core.message, when, empty } };
}

function readYearOverYear(core: Core): Reading {
  const proportion = core.raw.proportion;
  const value = typeof proportion === 'string' ? readDecimal(proportion) : null;
  const verdict = ADMITTED_VERDICTS[RULE_KIND.YEAR_OVER_YEAR].find((admitted) => admitted === core.raw.verdict);
  if (typeof proportion !== 'string' || value === null || value.units <= 0n || verdict === undefined) {
    return refused((value === null || value.units <= 0n) && RULE_PROBLEM.MALFORMED_NUMBER);
  }
  return { rule: { id: core.id, kind: RULE_KIND.YEAR_OVER_YEAR, verdict, message: core.message, proportion } };
}

const READERS: Readonly<Record<RuleKind, (core: Core) => Reading>> = {
  [RULE_KIND.REQUIRED]: readRequired,
  [RULE_KIND.REQUIRED_ANY]: readRequiredAny,
  [RULE_KIND.ROW_COMPLETE]: readRowComplete,
  [RULE_KIND.SUM]: readSum,
  [RULE_KIND.RANGE]: readRange,
  [RULE_KIND.URL]: readUrl,
  [RULE_KIND.EXCLUSIVE]: readExclusive,
  [RULE_KIND.YEAR_OVER_YEAR]: readYearOverYear,
};

function readRule(raw: unknown): Reading {
  if (!isRecord(raw)) return refused(RULE_PROBLEM.NOT_A_RULE);
  if (!isRuleKind(raw.kind)) return refused(RULE_PROBLEM.UNKNOWN_KIND);
  const kind = raw.kind;
  const id = isName(raw.id) ? raw.id : null;
  const message = typeof raw.message === 'string' && MESSAGE_KEY.test(raw.message) ? raw.message : null;
  // The kind's reader also refuses an unadmitted verdict — it needs the verdict typed to build the rule — so the code
  // is stated once, here, and every kind's spec case for it proves the two agree.
  const shaped = READERS[kind]({ id: id ?? '', message: message ?? '', raw });
  const found = codes(
    id === null && RULE_PROBLEM.MISSING_ID,
    message === null && RULE_PROBLEM.MISSING_MESSAGE,
    !ADMITTED_VERDICTS[kind].some((admitted) => admitted === raw.verdict) && RULE_PROBLEM.VERDICT_NOT_ADMITTED,
    !onlyHas(raw, [...COMMON, ...PROPERTIES[kind]]) && RULE_PROBLEM.UNEXPECTED_PROPERTY,
    ...('problems' in shaped ? shaped.problems : []),
  );
  return found.length > 0 ? { problems: found } : shaped;
}

export function readRuleSet(payload: unknown): RuleSetReading {
  if (!isRecord(payload) || !onlyHas(payload, ['rules']) || !Array.isArray(payload.rules)) {
    return {
      outcome: RULE_SET_READ.REFUSED,
      problems: [{ index: null, id: null, problem: RULE_PROBLEM.NOT_A_RULE_SET }],
    };
  }
  const rawRules: readonly unknown[] = payload.rules;
  const ids = rawRules.map((raw) => (isRecord(raw) && isName(raw.id) ? raw.id : null));
  const firstYearOverYear = rawRules.findIndex((raw) => isRecord(raw) && raw.kind === RULE_KIND.YEAR_OVER_YEAR);
  const readings = rawRules.map((raw, index) => {
    const id = ids[index];
    const reading = readRule(raw);
    const problems = [
      ...('problems' in reading ? reading.problems : []),
      ...(id !== null && ids.indexOf(id) < index ? [RULE_PROBLEM.DUPLICATE_ID] : []),
      ...(isRecord(raw) && raw.kind === RULE_KIND.YEAR_OVER_YEAR && index > firstYearOverYear
        ? [RULE_PROBLEM.SECOND_YEAR_OVER_YEAR]
        : []),
    ];
    return { index, id, reading, problems };
  });
  const problems = readings.flatMap(({ index, id, problems: found }) =>
    found.map((problem) => ({ index, id, problem })),
  );
  if (problems.length > 0) return { outcome: RULE_SET_READ.REFUSED, problems };
  return {
    outcome: RULE_SET_READ.READ,
    ruleSet: { rules: readings.flatMap(({ reading }) => ('rule' in reading ? [reading.rule] : [])) },
  };
}
