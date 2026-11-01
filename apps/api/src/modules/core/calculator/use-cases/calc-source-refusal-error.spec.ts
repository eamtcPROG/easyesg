import { ReportNotFoundError, TaxonomyVersionUnavailableError } from '@api/modules/core/disclosure/errors/report.errors';
import { CALC_SOURCE_REFUSAL } from '../domain/calc-source-check';
import { CalcSourceElsewhereError, NoFactorSetError, UnknownCalcSiteError } from '../errors/calculator.errors';
import { calcSourceRefusalError, isLineRefusal } from './calc-source-refusal-error';

/** Task 218: which refusals are the line's own — set aside by autosave — and which are the report's, which hold the queue. */
describe('isLineRefusal', () => {
  it('reads every refusal a line check answers as the line’s', () => {
    for (const refusal of Object.values(CALC_SOURCE_REFUSAL)) {
      expect(isLineRefusal(calcSourceRefusalError(refusal))).toBe(true);
    }
    expect(isLineRefusal(new UnknownCalcSiteError())).toBe(true);
    expect(isLineRefusal(new CalcSourceElsewhereError())).toBe(true);
  });

  it('reads a refusal of the report as not the line’s', () => {
    expect(isLineRefusal(new NoFactorSetError())).toBe(false);
    expect(isLineRefusal(new ReportNotFoundError())).toBe(false);
    expect(isLineRefusal(new TaxonomyVersionUnavailableError())).toBe(false);
    expect(isLineRefusal(new Error('anything else'))).toBe(false);
  });
});
