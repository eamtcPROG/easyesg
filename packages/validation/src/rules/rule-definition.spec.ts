import { describe, expect, it } from 'vitest';
import { RELATION, RULE_KIND, isRelation, isRuleKind } from './rule-definition.js';

/** The two narrowings a rule set read from the store needs, beside the vocabularies they narrow to. */
describe('isRuleKind', () => {
  it('admits every kind the vocabulary declares', () => {
    for (const kind of Object.values(RULE_KIND)) expect(isRuleKind(kind)).toBe(true);
  });

  it('refuses anything else, a kind in the wrong case included', () => {
    for (const value of ['regex', 'REQUIRED', '', undefined, 1]) expect(isRuleKind(value)).toBe(false);
  });
});

describe('isRelation', () => {
  it('admits every relation the vocabulary declares', () => {
    for (const relation of Object.values(RELATION)) expect(isRelation(relation)).toBe(true);
  });

  it('refuses anything else', () => {
    for (const value of ['greater_than', 'EQUAL', '', null, true]) expect(isRelation(value)).toBe(false);
  });
});
