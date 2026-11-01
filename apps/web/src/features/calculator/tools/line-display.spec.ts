import { LINE_OUTCOME } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { LINE_DISPLAY, lineDisplay } from './line-display';

const measured = { pending: false, notAvailableReason: null };
const computed = {
  sourceId: 'gas',
  outcome: LINE_OUTCOME.COMPUTED,
  megawattHours: '4.78865',
  tonnesCo2e: '0.9699123256',
  computedTonnesCo2e: null,
  explanation: null,
};

describe('lineDisplay (task 39.2)', () => {
  it('shows a computed line’s MWh and tonnes', () => {
    expect(lineDisplay({ line: measured, result: computed, uncovered: false })).toEqual({
      kind: LINE_DISPLAY.COMPUTED,
      megawattHours: '4.78865',
      tonnesCo2e: '0.9699123256',
    });
  });

  it('shows the reporter’s tonnes for a line whose tonnes were replaced — the figure the scope counts', () => {
    const overridden = { ...computed, outcome: LINE_OUTCOME.OVERRIDDEN, tonnesCo2e: '0.84', computedTonnesCo2e: '0.89' };
    expect(lineDisplay({ line: measured, result: overridden, uncovered: false })).toMatchObject({ tonnesCo2e: '0.84' });
  });

  it('waits for a line the server has not computed — queued, or newer than the figures read — never a zero', () => {
    expect(lineDisplay({ line: { ...measured, pending: true }, result: computed, uncovered: false }).kind).toBe(LINE_DISPLAY.WAITING);
    expect(lineDisplay({ line: measured, result: undefined, uncovered: false }).kind).toBe(LINE_DISPLAY.WAITING);
  });

  it('has nothing to convert for an explained line, and says so for one the set no longer covers', () => {
    expect(lineDisplay({ line: { ...measured, notAvailableReason: 'Billed' }, result: undefined, uncovered: false }).kind).toBe(
      LINE_DISPLAY.EXPLAINED,
    );
    expect(lineDisplay({ line: measured, result: undefined, uncovered: true }).kind).toBe(LINE_DISPLAY.UNCOVERED);
  });
});
