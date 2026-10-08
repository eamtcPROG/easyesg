import { ruleSetRefusal } from './rule-set-publication';

const required = {
  id: 'b1-turnover',
  kind: 'required',
  verdict: 'missing',
  message: 'validation.required',
  fields: [{ element: 'Turnover' }],
};

const worded = (keys: readonly string[]) => (key: string) => keys.includes(key);

describe('ruleSetRefusal', () => {
  it('admits a set the interpreter reads whose every message key is worded as a finding', () => {
    expect(ruleSetRefusal({ payload: { rules: [required] }, wordedAsFinding: worded(['validation.required']) })).toBeNull();
  });

  it('refuses a set the interpreter cannot hold, naming the rule and the problem', () => {
    const reason = ruleSetRefusal({
      payload: { rules: [{ ...required, verdict: 'error' }] },
      wordedAsFinding: worded(['validation.required']),
    });
    expect(reason).toContain('b1-turnover: verdict_not_admitted');
  });

  it('refuses a payload that is not a rule set at all', () => {
    expect(ruleSetRefusal({ payload: { rule: [] }, wordedAsFinding: worded([]) })).toContain('the set: not_a_rule_set');
  });

  it('refuses a message key some locale does not word in its three parts, naming each once', () => {
    const reason = ruleSetRefusal({
      payload: { rules: [required, { ...required, id: 'b1-assets', fields: [{ element: 'Assets' }] }] },
      wordedAsFinding: worded([]),
    });
    expect(reason).toBe(
      "its message key(s) are not worded in their three parts — happened, consequence, action — in every locale's " +
        'catalogue: validation.required',
    );
  });
});
