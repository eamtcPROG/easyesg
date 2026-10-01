import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { placeOf } from './step-place';

/** Task 179.3's one place: where *Module n of m*, the stepper's position, *Back* and *Next* all come from. */
const summary = (module: string, overrides: Partial<DisclosureModuleSummary> = {}): DisclosureModuleSummary => ({
  module,
  answered: 0,
  total: 5,
  lastAnsweredAt: null,
  applicable: true,
  omitted: false,
  applicabilityCause: null,
  ...overrides,
});

const modules = [summary('B1'), summary('B2'), summary('B3')];

describe('placeOf', () => {
  it('places the module by its position in the list, and leads to the modules either side', () => {
    expect(placeOf({ modules, current: 'B2' })).toEqual({ position: 2, total: 3, previous: 'B1', next: 'B3' });
  });

  it('offers no way back from the first module, and no way on from the last', () => {
    expect(placeOf({ modules, current: 'B1' })).toMatchObject({ position: 1, previous: null, next: 'B2' });
    expect(placeOf({ modules, current: 'B3' })).toMatchObject({ position: 3, previous: 'B2', next: null });
  });

  it('never gates: the next module is the next one, waiting on B1, ruled out or omitted', () => {
    // Waiting is *not applicable* with a cause whose deciding answer is still absent (`moduleStateOf`).
    const waiting = summary('B5', {
      applicable: false,
      applicabilityCause: {
        condition: 'numeric_at_least',
        drivers: [{ elementKey: 'NumberOfEmployees', label: null }],
        threshold: '50',
        answer: null,
      },
    });
    const gated = [summary('B4'), waiting, summary('B6', { applicable: false }), summary('B7', { omitted: true })];

    expect(placeOf({ modules: gated, current: 'B4' }).next).toBe('B5');
    expect(placeOf({ modules: gated, current: 'B5' }).next).toBe('B6');
    expect(placeOf({ modules: gated, current: 'B6' }).next).toBe('B7');
    expect(placeOf({ modules: gated, current: 'B7' })).toMatchObject({ position: 4, total: 4, previous: 'B6' });
  });

  it('places nowhere a module the list does not carry', () => {
    expect(placeOf({ modules, current: 'C1' })).toEqual({ position: 0, total: 3, previous: null, next: null });
  });
});
