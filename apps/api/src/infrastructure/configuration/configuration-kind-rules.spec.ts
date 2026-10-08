import { VALIDATION_RULE_SET_CONFIG_KIND } from '@api/modules/core/validation/constants/validation.constants';
import { ruleFor } from './configuration-kind-rules';

/**
 * Which rule the store asks of a kind before it writes (tasks 37.4, 39.2, 41.1). Each kind's rule is its module's and
 * is specified there; what this spec holds is the **binding** — that a validation rule set is refused at publication
 * against the release's own catalogues, so the seed loader and A-05 meet the same refusal (FR-73 item 8, 182/51).
 */
describe('configuration kind rules', () => {
  const rule = (message: string) => ({
    rules: [{ id: 'b1-turnover', kind: 'required', verdict: 'missing', message, fields: [{ element: 'Turnover' }] }],
  });

  it('refuses a validation rule set whose message the committed catalogues do not word', () => {
    const refusal = ruleFor(VALIDATION_RULE_SET_CONFIG_KIND).refusal;
    expect(refusal?.(rule('validation.required'))).toBeNull();
    expect(refusal?.(rule('validation.nowhere'))).toContain('validation.nowhere');
  });

  it('asks nothing of a kind no module bound a rule to', () => {
    expect(ruleFor('locale_registration')).toEqual({});
  });
});
