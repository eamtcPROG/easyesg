import { DISCLOSURE_ORIGIN } from '../models/disclosure-value.model';
import { FakeFigureStore, REPORT } from '../testing/figure-store.fakes';
import { WriteCalculatedFigures } from './write-calculated-figures.use-case';

/** A run's figures arriving in the store (task 38.4): what is written, what an empty scope clears, what is recomputed. */
describe('WriteCalculatedFigures', () => {
  const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
  const SCOPE_2 = 'GrossLocationBasedScope2GreenhouseGasEmissions';

  const write = (store: FakeFigureStore, figures: { elementKey: string; valueNumeric: string | null }[]) =>
    new WriteCalculatedFigures(store.values, store.recalculator).execute({ reportId: REPORT, standard: 'vsme', figures });

  it('writes each measured figure as calculated, over whatever the field held', async () => {
    const store = new FakeFigureStore({ [SCOPE_1]: { origin: DISCLOSURE_ORIGIN.REPORTED } });
    await write(store, [
      { elementKey: SCOPE_1, valueNumeric: '0.9699123256' },
      { elementKey: SCOPE_2, valueNumeric: '10.108965' },
    ]);
    expect(store.figures.get(SCOPE_1)).toEqual({ valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null });
    expect(store.figures.get(SCOPE_2)).toEqual({ valueNumeric: '10.108965', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null });
  });

  it('replaces an override, and its reason goes with it', async () => {
    const store = new FakeFigureStore({
      [SCOPE_1]: { valueNumeric: '0.84', origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Metered by the landlord' },
    });
    await write(store, [{ elementKey: SCOPE_1, valueNumeric: '0.9699123256' }]);
    expect(store.figures.get(SCOPE_1)).toEqual({ valueNumeric: '0.9699123256', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null });
  });

  it('keeps an annotation on a figure that stays computed', async () => {
    const store = new FakeFigureStore({
      [SCOPE_2]: { valueNumeric: '10', origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: 'Cahul is estimated' },
    });
    await write(store, [{ elementKey: SCOPE_2, valueNumeric: '10.108965' }]);
    expect(store.figures.get(SCOPE_2)?.explanation).toBe('Cahul is estimated');
  });

  it('clears an empty scope only where an earlier run wrote it', async () => {
    const store = new FakeFigureStore({
      [SCOPE_1]: { origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: 'A note' },
      [SCOPE_2]: { origin: DISCLOSURE_ORIGIN.REPORTED },
    });
    await write(store, [
      { elementKey: SCOPE_1, valueNumeric: null },
      { elementKey: SCOPE_2, valueNumeric: null },
    ]);
    // The computed figure no longer has lines behind it; the typed one never had any.
    expect(store.figures.get(SCOPE_1)).toEqual({ valueNumeric: null, origin: DISCLOSURE_ORIGIN.CALCULATED, explanation: null });
    expect(store.figures.get(SCOPE_2)).toEqual({ valueNumeric: '1', origin: DISCLOSURE_ORIGIN.REPORTED, explanation: null });
  });

  it('leaves an override alone when the run measured nothing of its scope', async () => {
    const store = new FakeFigureStore({ [SCOPE_2]: { origin: DISCLOSURE_ORIGIN.OVERRIDDEN, explanation: 'Supplier’s figure' } });
    await write(store, [{ elementKey: SCOPE_2, valueNumeric: null }]);
    expect(store.figures.get(SCOPE_2)?.origin).toBe(DISCLOSURE_ORIGIN.OVERRIDDEN);
  });

  it('writes nothing for an empty scope nobody had answered', async () => {
    const store = new FakeFigureStore();
    await write(store, [{ elementKey: SCOPE_2, valueNumeric: null }]);
    expect(store.figures.has(SCOPE_2)).toBe(false);
  });

  it('recomputes what every figure feeds, written or not', async () => {
    const store = new FakeFigureStore();
    await write(store, [
      { elementKey: SCOPE_1, valueNumeric: '1' },
      { elementKey: SCOPE_2, valueNumeric: null },
    ]);
    expect(store.recomputed).toEqual([new Set([SCOPE_1, SCOPE_2])]);
  });
});
