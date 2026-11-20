import { evaluateRules, type RuleSet } from '@easyesg/validation';
import type { EvaluationScope } from '../interfaces/evaluation-scopes.interface';
import { withDerivationInputs } from './derivation-input-fields';

/** Task 254: the derivation inputs read into a run as fields a rule can require. */
describe('withDerivationInputs', () => {
  const COVERED = 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements';
  const evaluation = (inputs: EvaluationScope['inputs']): EvaluationScope => ({
    values: [{ elementKey: 'NumberOfEmployees', dimensionKey: '', ordinal: 0, valueNumeric: '40', state: 'ok' }],
    scope: new Map([
      ['NumberOfEmployees', ['B1']],
      ['PercentageOfEmployeesCoveredByCollectiveBargainingAgreements', ['B10']],
    ]),
    modules: ['B1', 'B10'],
    inputs,
  });

  it('places each input in its figure’s modules, under its input: key', () => {
    const widened = withDerivationInputs(evaluation([{ key: COVERED, modules: ['B10'], value: null }]));

    expect(widened.scope.get(`input:${COVERED}`)).toEqual(['B10']);
    // The report's own scope is kept whole beside it.
    expect(widened.scope.get('NumberOfEmployees')).toEqual(['B1']);
  });

  it('reads a stored input as an answer, and an unstored one as no row at all', () => {
    const answered = withDerivationInputs(evaluation([{ key: COVERED, modules: ['B10'], value: '12' }]));
    const unanswered = withDerivationInputs(evaluation([{ key: COVERED, modules: ['B10'], value: null }]));

    expect(answered.values).toContainEqual({ elementKey: `input:${COVERED}`, dimensionKey: '', ordinal: 0, valueNumeric: '12' });
    expect(unanswered.values.map((value) => value.elementKey)).toEqual(['NumberOfEmployees']);
  });

  it('lets a required rule find an unanswered input, and clear once it is answered', () => {
    const ruleSet: RuleSet = {
      rules: [
        {
          id: 'b10-collective-bargaining',
          kind: 'required' as const,
          verdict: 'missing' as const,
          message: 'validation.input_required',
          fields: [{ element: `input:${COVERED}` }],
        },
      ],
    };
    const findingsOver = (value: string | null) => {
      const widened = withDerivationInputs(evaluation([{ key: COVERED, modules: ['B10'], value }]));
      return evaluateRules({ ruleSet, scope: new Set(widened.scope.keys()), values: widened.values, prior: [] });
    };

    expect(findingsOver(null).map((finding) => finding.field.elementKey)).toEqual([`input:${COVERED}`]);
    expect(findingsOver('0')).toEqual([]);
  });

  it('changes nothing where no figure in scope reads an input', () => {
    const plain = evaluation([]);

    expect(withDerivationInputs(plain)).toBe(plain);
  });
});
