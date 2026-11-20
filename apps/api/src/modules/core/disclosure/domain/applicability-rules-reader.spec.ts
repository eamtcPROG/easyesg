import { applicabilityRefusal, readApplicabilityRules } from './applicability-rules-reader';

const RULE = { elements: ['EmployeeTurnoverRate'], condition: { kind: 'numeric_at_least', elementKey: 'NumberOfEmployees', threshold: '50' } };

describe('the applicability payload, read (tasks 91.3, 67.8)', () => {
  it('reads every rule it can, and names each it cannot by its index', () => {
    const read = readApplicabilityRules({ rules: [RULE, { elements: ['X'], condition: { kind: 'numeric_at_least', elementKey: 'Y', threshold: 'fifty' } }] });
    expect(read?.rules).toHaveLength(1);
    expect(read?.dropped).toEqual([1]);
    expect(readApplicabilityRules({ rules: 'none' })).toBeNull();
  });

  it('refuses at publication a payload with no rule list or with any rule the wizard would drop', () => {
    expect(applicabilityRefusal({ rules: [RULE] })).toBeNull();
    expect(applicabilityRefusal({})).toBe('lists no rules');
    expect(applicabilityRefusal({ rules: [RULE, { elements: [], condition: RULE.condition }] })).toBe('rule 2 is unreadable');
  });
});
