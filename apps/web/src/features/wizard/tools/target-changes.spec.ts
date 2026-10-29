import { describe, expect, it } from 'vitest';
import { targetChanges, targetFigures } from './target-changes';

/** C3's two worked-out changes (task 79.3; UC-185 step 3). */
describe('targetChanges', () => {
  it('works out the change the target seeks and the change so far, each from the base year, signed', () => {
    const changes = targetChanges({ base: '40', target: '30', current: '37' });
    expect(Number(changes.sought)).toBeCloseTo(-0.25, 12);
    expect(Number(changes.sinceBase)).toBeCloseTo(-0.075, 12);
  });

  it('reads a rise as positive, the template’s own sign', () => {
    expect(Number(targetChanges({ base: '40', target: '50', current: null }).sought)).toBeCloseTo(0.25, 12);
  });

  it('works out no change from a base of zero, or with either figure missing', () => {
    expect(targetChanges({ base: '0', target: '10', current: '5' })).toEqual({ sought: null, sinceBase: null });
    expect(targetChanges({ base: null, target: '10', current: '5' })).toEqual({ sought: null, sinceBase: null });
    expect(targetChanges({ base: '40', target: null, current: '' })).toEqual({ sought: null, sinceBase: null });
  });

  it('answers decimal text a share is laid out from, never exponent notation', () => {
    expect(targetChanges({ base: '3', target: '3.000000000001', current: null }).sought).toBe('0');
  });
});

describe('targetFigures', () => {
  const target = { axis: 'ReportingScopesAxis', base: 'BaselineYearMember', target: 'TargetYearMember' };

  it('picks one emission’s base, target and reporting-year figure out of the held answers', () => {
    const held = [
      { elementKey: 'GrossScope1', dimensionKey: '', valueNumeric: '38.7' },
      { elementKey: 'GrossScope1', dimensionKey: 'BaselineYearMember', valueNumeric: '41.8' },
      { elementKey: 'GrossScope1', dimensionKey: 'TargetYearMember', valueNumeric: '31.4' },
      { elementKey: 'GrossScope2', dimensionKey: 'BaselineYearMember', valueNumeric: '9' },
    ];
    expect(targetFigures({ elementKey: 'GrossScope1', target, held })).toEqual({
      base: '41.8',
      target: '31.4',
      current: '38.7',
    });
  });

  it('answers nothing for a figure the wizard does not hold', () => {
    expect(targetFigures({ elementKey: 'GrossScope1', target, held: [] })).toEqual({
      base: null,
      target: null,
      current: null,
    });
  });
});
