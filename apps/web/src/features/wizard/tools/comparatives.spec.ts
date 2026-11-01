import { describe, expect, it } from 'vitest';
import { COMPARABILITY, DISCLOSURE_KIND, DISCLOSURE_STATE } from '@easyesg/contracts';
import type { PriorPeriodComparatives } from '@easyesg/contracts';
import { priorDraftOf, priorValuesOf } from './comparatives';
import { writeKey } from './autosave-state';

/**
 * Last year's answers, indexed for this year's fields (FR-46, UC-45; task 36.14).
 *
 * These are the cases that fail on a screen which looks perfectly correct: a comparative shown
 * beside the wrong row, or beside a field measuring something else. Both render as a plausible
 * number next to an input, which is precisely what FR-46 exists to let a reporter check.
 */
describe('priorValuesOf', () => {
  const value = (over: Partial<PriorPeriodComparatives['values'][number]> = {}) => ({
    elementKey: 'TotalEnergyConsumption',
    dimensionKey: '',
    ordinal: 0,
    valueNumeric: '1240',
    valueText: null,
    valueBoolean: null,
    valueDate: null,
    unitCode: 'MWh',
    state: DISCLOSURE_STATE.OK,
    comparability: COMPARABILITY.COMPARABLE,
    ...over,
  });
  const readout = (values: PriorPeriodComparatives['values']): PriorPeriodComparatives =>
    ({ values }) as PriorPeriodComparatives;

  it('keys a prior answer by the whole natural key, not by its element', () => {
    // B8's Moldova row and its Romania row are different answers to one element. Keyed by element,
    // one country's headcount would sit beside another's — a plausible number in the wrong place.
    const indexed = priorValuesOf(
      readout([
        value({ elementKey: 'NumberOfEmployeesForCountryOfEmploymentContract', dimensionKey: 'MD', valueNumeric: '42' }),
        value({ elementKey: 'NumberOfEmployeesForCountryOfEmploymentContract', dimensionKey: 'RO', valueNumeric: '7' }),
      ]),
    );
    expect(indexed.size).toBe(2);
    expect(
      indexed.get(writeKey({ elementKey: 'NumberOfEmployeesForCountryOfEmploymentContract', dimensionKey: 'MD', ordinal: 0 }))
        ?.valueNumeric,
    ).toBe('42');
  });

  it('separates two ordinals of a repeating group', () => {
    const indexed = priorValuesOf(
      readout([
        value({ elementKey: 'AddressOfSite', ordinal: 0, valueNumeric: null, valueText: 'Chișinău' }),
        value({ elementKey: 'AddressOfSite', ordinal: 1, valueNumeric: null, valueText: 'Bălți' }),
      ]),
    );
    expect(indexed.get(writeKey({ elementKey: 'AddressOfSite', ordinal: 1 }))?.valueText).toBe('Bălți');
  });

  it('drops a value whose element this year’s taxonomy no longer names', () => {
    expect(priorValuesOf(readout([value({ comparability: COMPARABILITY.ELEMENT_ABSENT })])).size).toBe(0);
  });

  it('drops a value whose shape moved between the two pinned versions', () => {
    // A duration that became an instant is not last year's figure, and showing it beside this
    // year's input invites exactly the false comparison FR-46 exists to prevent.
    expect(priorValuesOf(readout([value({ comparability: COMPARABILITY.SHAPE_CHANGED })])).size).toBe(0);
  });

  it('is empty where no comparative was read at all', () => {
    // A first year, an unlinked period, or a failed read — the step renders either way.
    expect(priorValuesOf(null).size).toBe(0);
  });
});

describe('priorDraftOf', () => {
  const prior = (over: Record<string, unknown>) =>
    ({
      valueNumeric: null,
      valueText: null,
      valueBoolean: null,
      valueDate: null,
      ...over,
    }) as PriorPeriodComparatives['values'][number];

  it('reads the column this field’s kind uses, not whichever one is filled', () => {
    expect(
      priorDraftOf({ field: { kind: DISCLOSURE_KIND.NUMERIC }, prior: prior({ valueNumeric: '1240' }) }),
    ).toBe('1240');
    expect(
      priorDraftOf({ field: { kind: DISCLOSURE_KIND.TEXT_BLOCK }, prior: prior({ valueText: 'unchanged' }) }),
    ).toBe('unchanged');
  });

  it('reads monetary from the numeric column, which is where it is stored', () => {
    expect(priorDraftOf({ field: { kind: DISCLOSURE_KIND.MONETARY }, prior: prior({ valueNumeric: '5000' }) })).toBe(
      '5000',
    );
  });

  it('is empty where last year holds nothing in that column', () => {
    // A field answered *not available* last year carries a state and a reason and no figure, so
    // there is no comparative to show — and "Prior period:" followed by nothing is worse than none.
    expect(priorDraftOf({ field: { kind: DISCLOSURE_KIND.NUMERIC }, prior: prior({ valueText: 'a reason' }) })).toBe('');
  });
});
