import { NoComputedFigureError } from '../errors/report.errors';
import { DISCLOSURE_ORIGIN } from '../models/disclosure-value.model';
import { FakeFigureStore, REPORT } from '../testing/figure-store.fakes';
import { ExplainCalculatedFigure } from './explain-calculated-figure.use-case';
import { OverrideCalculatedFigure } from './override-calculated-figure.use-case';
import { RestoreCalculatedFigure } from './restore-calculated-figure.use-case';

/** UC-34's two verbs over a computed B3 figure, and the override's removal (task 38.4; FR-36, UX-43). */
describe('a computed figure, explained or replaced', () => {
  const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
  const computed = { valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED };

  const override = (store: FakeFigureStore, valueNumeric = '0.84', explanation = 'The accountant’s figure') =>
    new OverrideCalculatedFigure(store.values, store.recalculator).execute({
      reportId: REPORT,
      standard: 'vsme',
      elementKey: SCOPE_1,
      valueNumeric,
      explanation,
    });

  describe('OverrideCalculatedFigure', () => {
    it('replaces a computed figure with the reporter’s, its reason beside it, and recomputes what it feeds', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: computed });
      await override(store);
      expect(store.figures.get(SCOPE_1)).toEqual({
        valueNumeric: '0.84',
        origin: DISCLOSURE_ORIGIN.OVERRIDDEN,
        explanation: 'The accountant’s figure',
      });
      expect(store.recomputed).toEqual([new Set([SCOPE_1])]);
    });

    it('changes an override’s figure and reason, which is overriding again', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: { valueNumeric: '0.84', origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Old' } });
      await override(store, '0.86', 'New');
      expect(store.figures.get(SCOPE_1)).toMatchObject({ valueNumeric: '0.86', explanation: 'New' });
    });

    it.each([
      ['a typed figure', { origin: DISCLOSURE_ORIGIN.REPORTED }],
      ['a computed figure a run cleared', { valueNumeric: null, origin: DISCLOSURE_ORIGIN.CALCULATED }],
    ])('refuses %s, which has nothing computed to supersede', async (_case, standing) => {
      const store = new FakeFigureStore({ [SCOPE_1]: standing });
      await expect(override(store)).rejects.toBeInstanceOf(NoComputedFigureError);
    });

    it('refuses an empty field', async () => {
      await expect(override(new FakeFigureStore())).rejects.toBeInstanceOf(NoComputedFigureError);
    });
  });

  describe('RestoreCalculatedFigure', () => {
    const restore = (store: FakeFigureStore) =>
      new RestoreCalculatedFigure(store.values, store.recalculator).execute({
        reportId: REPORT,
        standard: 'vsme',
        elementKey: SCOPE_1,
        valueNumeric: '0.9699123256',
      });

    it('puts the computed figure back, as calculated, without the override’s reason', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: { valueNumeric: '0.84', origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Why' } });
      await restore(store);
      expect(store.figures.get(SCOPE_1)).toEqual({ ...computed, explanation: null });
      expect(store.recomputed).toEqual([new Set([SCOPE_1])]);
    });

    it('does nothing where no override stands', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: { valueNumeric: '3', origin: DISCLOSURE_ORIGIN.REPORTED } });
      await restore(store);
      expect(store.figures.get(SCOPE_1)).toMatchObject({ valueNumeric: '3', origin: DISCLOSURE_ORIGIN.REPORTED });
      expect(store.recomputed).toEqual([]);
    });
  });

  describe('ExplainCalculatedFigure', () => {
    const explain = (store: FakeFigureStore, explanation: string | null) =>
      new ExplainCalculatedFigure(store.values).execute({ reportId: REPORT, elementKey: SCOPE_1, explanation });

    it('notes a computed figure that stands, leaving the figure as it is', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: computed });
      await explain(store, 'One site is estimated');
      expect(store.figures.get(SCOPE_1)).toEqual({ ...computed, explanation: 'One site is estimated' });
    });

    it('removes the note when asked with none', async () => {
      const store = new FakeFigureStore({ [SCOPE_1]: { ...computed, explanation: 'Old note' } });
      await explain(store, null);
      expect(store.figures.get(SCOPE_1)?.explanation).toBeNull();
    });

    it.each([
      ['an overridden figure, whose words are its reason', { origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Why' }],
      ['a typed figure', { origin: DISCLOSURE_ORIGIN.REPORTED }],
      ['a cleared computed figure', { valueNumeric: null, origin: DISCLOSURE_ORIGIN.CALCULATED }],
    ])('refuses %s', async (_case, standing) => {
      const store = new FakeFigureStore({ [SCOPE_1]: standing });
      await expect(explain(store, 'A note')).rejects.toBeInstanceOf(NoComputedFigureError);
    });
  });
});
