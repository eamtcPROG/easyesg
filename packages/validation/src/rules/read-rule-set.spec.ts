import { describe, expect, it } from 'vitest';
import { RULE_PROBLEM, RULE_SET_READ, readRuleSet, type RuleProblemCode } from './read-rule-set.js';

/**
 * The reader 41.1 and A-05 both put a payload through (task 40.1): what it admits comes back rebuilt, and what the
 * vocabulary cannot hold is refused with the rule and the problem named. Literals throughout, on purpose — the wire
 * values are what a stored payload is written in.
 */
const VALID = {
  required: {
    id: 'r',
    kind: 'required',
    verdict: 'missing',
    message: 'validation.required',
    fields: [{ element: 'NumberOfEmployees' }, { element: 'EnergyConsumptionFromFuels', member: 'RenewableEnergyMember' }],
    when: { kind: 'is_true', element: 'PubliclyAvailableDisclosure' },
  },
  required_any: {
    id: 'ra',
    kind: 'required_any',
    verdict: 'missing',
    message: 'validation.required_any',
    fields: [{ element: 'A' }, { element: 'B' }],
  },
  row_complete: { id: 'rc', kind: 'row_complete', verdict: 'missing', message: 'validation.row', elements: ['A', 'B'] },
  sum: {
    id: 's',
    kind: 'sum',
    verdict: 'inconsistency',
    message: 'validation.sum',
    parts: [{ element: 'A', weight: '1' }, { element: 'B', member: 'M', weight: '-1' }, { element: 'C' }],
    total: { element: 'T' },
    relation: 'at_most',
  },
  range: { id: 'g', kind: 'range', verdict: 'error', message: 'validation.range', fields: [{ element: 'A' }], min: '0', max: '100' },
  url: { id: 'u', kind: 'url', verdict: 'invalid_url', message: 'validation.url', fields: [{ element: 'A' }] },
  exclusive: {
    id: 'x',
    kind: 'exclusive',
    verdict: 'inconsistency',
    message: 'validation.exclusive',
    when: { kind: 'answered', element: 'A' },
    empty: ['B', 'C'],
  },
  year_over_year: { id: 'y', kind: 'year_over_year', verdict: 'inconsistency', message: 'validation.yoy', proportion: '0.5' },
} as const;

const problemsOf = (payload: unknown): readonly { index: number | null; id: string | null; problem: RuleProblemCode }[] => {
  const reading = readRuleSet(payload);
  return reading.outcome === RULE_SET_READ.REFUSED ? reading.problems : [];
};

/** The codes one rule is refused with, alone in a set. */
const refusing = (rule: unknown): readonly RuleProblemCode[] => problemsOf({ rules: [rule] }).map(({ problem }) => problem);

describe('readRuleSet', () => {
  it('reads one rule of every kind back as it was written', () => {
    const rules = Object.values(VALID);
    expect(readRuleSet({ rules })).toEqual({ outcome: RULE_SET_READ.READ, ruleSet: { rules } });
  });

  it('reads an empty set', () => {
    expect(readRuleSet({ rules: [] })).toEqual({ outcome: RULE_SET_READ.READ, ruleSet: { rules: [] } });
  });

  it('refuses a payload that is not { rules: [...] }', () => {
    for (const payload of [null, [], 'rules', { rules: {} }, { rules: [], version: 2 }]) {
      expect(problemsOf(payload)).toEqual([{ index: null, id: null, problem: RULE_PROBLEM.NOT_A_RULE_SET }]);
    }
  });

  it('names the rule and every problem it has', () => {
    expect(problemsOf({ rules: [VALID.url, { ...VALID.range, id: '', message: 'two words', max: '-1' }] })).toEqual([
      { index: 1, id: null, problem: RULE_PROBLEM.MISSING_ID },
      { index: 1, id: null, problem: RULE_PROBLEM.MISSING_MESSAGE },
      { index: 1, id: null, problem: RULE_PROBLEM.EMPTY_RANGE },
    ]);
  });

  it('refuses an entry that is not a rule, and a kind outside the vocabulary', () => {
    expect(refusing('required')).toEqual([RULE_PROBLEM.NOT_A_RULE]);
    expect(refusing({ ...VALID.url, kind: 'regex' })).toEqual([RULE_PROBLEM.UNKNOWN_KIND]);
  });

  it('refuses a second rule with an id already used, naming the second', () => {
    expect(problemsOf({ rules: [VALID.url, { ...VALID.range, id: 'u' }] })).toEqual([
      { index: 1, id: 'u', problem: RULE_PROBLEM.DUPLICATE_ID },
    ]);
  });

  it.each(Object.entries(VALID))('refuses a verdict the %s kind does not admit', (_, rule) => {
    const foreign = rule.verdict === 'invalid_url' ? 'error' : 'invalid_url';
    expect(refusing({ ...rule, verdict: foreign })).toEqual([RULE_PROBLEM.VERDICT_NOT_ADMITTED]);
  });

  it('admits either verdict a sum may fire', () => {
    expect(refusing({ ...VALID.sum, verdict: 'missing' })).toEqual([]);
  });

  it('refuses a property the kind does not have', () => {
    expect(refusing({ ...VALID.sum, when: { kind: 'answered', element: 'A' } })).toEqual([RULE_PROBLEM.UNEXPECTED_PROPERTY]);
    expect(refusing({ ...VALID.year_over_year, fields: [{ element: 'A' }] })).toEqual([RULE_PROBLEM.UNEXPECTED_PROPERTY]);
  });

  it('refuses fields that are absent, empty or not an element and an optional member', () => {
    expect(refusing({ ...VALID.url, fields: [] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.url, fields: [{ member: 'M' }] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.url, fields: [{ element: 'A', member: '' }] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.url, fields: [{ element: 'A', weight: '1' }] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.row_complete, elements: ['A', ''] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.exclusive, empty: [] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.sum, parts: [] })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
    expect(refusing({ ...VALID.sum, total: undefined })).toEqual([RULE_PROBLEM.MALFORMED_FIELDS]);
  });

  it('refuses a condition outside its closed set', () => {
    expect(refusing({ ...VALID.required, when: { kind: 'equals', element: 'A' } })).toEqual([RULE_PROBLEM.MALFORMED_CONDITION]);
    expect(refusing({ ...VALID.exclusive, when: { kind: 'answered', element: 'A', value: true } })).toEqual([
      RULE_PROBLEM.MALFORMED_CONDITION,
    ]);
  });

  it('refuses a relation outside its closed set', () => {
    expect(refusing({ ...VALID.sum, relation: 'about' })).toEqual([RULE_PROBLEM.UNKNOWN_RELATION]);
  });

  it('refuses a weight, a bound or a proportion that is not a usable decimal', () => {
    expect(refusing({ ...VALID.sum, parts: [{ element: 'A', weight: '0' }] })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.sum, parts: [{ element: 'A', weight: 1 }] })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.range, min: 'zero' })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.range, max: 100 })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.year_over_year, proportion: '0' })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.year_over_year, proportion: '-0.5' })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
    expect(refusing({ ...VALID.year_over_year, proportion: 0.5 })).toEqual([RULE_PROBLEM.MALFORMED_NUMBER]);
  });

  it('refuses a range with no bound, or with its minimum above its maximum, and reads one bound alone', () => {
    const { min: _min, max: _max, ...unbounded } = VALID.range;
    expect(refusing(unbounded)).toEqual([RULE_PROBLEM.EMPTY_RANGE]);
    expect(refusing({ ...VALID.range, min: '10', max: '9.5' })).toEqual([RULE_PROBLEM.EMPTY_RANGE]);
    expect(refusing({ ...unbounded, min: '0' })).toEqual([]);
    expect(refusing({ ...VALID.range, min: '5', max: '5' })).toEqual([]);
  });

  it('refuses a second year-over-year rule — one proportion for every element (182/28)', () => {
    expect(problemsOf({ rules: [VALID.year_over_year, { ...VALID.year_over_year, id: 'y2' }] })).toEqual([
      { index: 1, id: 'y2', problem: RULE_PROBLEM.SECOND_YEAR_OVER_YEAR },
    ]);
  });

  it('rebuilds what it read rather than passing the payload through', () => {
    const reading = readRuleSet({ rules: [VALID.url] });
    if (reading.outcome !== RULE_SET_READ.READ) throw new Error('refused');
    const [rule] = reading.ruleSet.rules;
    expect(rule).not.toBe(VALID.url);
    expect('fields' in rule && rule.fields).not.toBe(VALID.url.fields);
    expect(rule).toEqual(VALID.url);
  });
});
