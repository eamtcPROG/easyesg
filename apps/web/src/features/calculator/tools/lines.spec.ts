import type { CalcLine } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { linesOf } from './lines';

const served = (id: string, quantity: string): CalcLine => ({
  id,
  siteOrdinal: 0,
  sourceKey: 'natural_gas',
  description: null,
  quantity,
  unitCode: 'm3',
  notAvailableReason: null,
  monthlyQuantities: null,
  overrideTonnes: null,
  overrideExplanation: null,
  overriddenBy: null,
  updatedAt: 1,
});

describe('linesOf (task 39.1)', () => {
  it('shows the served lines, in the server’s order, as stored', () => {
    const lines = linesOf({ served: [served('a', '500'), served('b', '1700')], committed: {}, pending: [] });
    expect(lines.map((line) => [line.id, line.quantity, line.pending])).toEqual([
      ['a', '500', false],
      ['b', '1700', false],
    ]);
  });

  it('lets an acknowledged write replace the served line, and an acknowledged removal take it away', () => {
    const lines = linesOf({
      served: [served('a', '500'), served('b', '1700')],
      committed: { a: served('a', '520'), b: null },
      pending: [],
    });
    expect(lines.map((line) => [line.id, line.quantity])).toEqual([['a', '520']]);
  });

  it('shows what is still queued over everything else, marked as waiting, and new lines after the served ones', () => {
    const lines = linesOf({
      served: [served('a', '500'), served('b', '1700')],
      committed: { a: served('a', '520') },
      pending: [
        { lineId: 'c', line: { siteOrdinal: 1, sourceKey: 'diesel', quantity: '332', unitCode: 'l' } },
        { lineId: 'a', line: { siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '540', unitCode: 'm3' } },
        { lineId: 'b', removed: true },
      ],
    });
    expect(lines.map((line) => [line.id, line.quantity, line.pending])).toEqual([
      ['a', '540', true],
      ['c', '332', true],
    ]);
  });

  /** Task 39.4: the table names whoever changes an override, and keeps the person of one written again unchanged. */
  describe('who replaced a line’s tonnes, while the line waits in the queue', () => {
    const ANA = { accountId: 'account-ana', name: 'Ana Popescu' };
    const overridden: CalcLine = {
      ...served('a', '500'),
      overrideTonnes: '0.84',
      overrideExplanation: 'One van was sub-leased',
      overriddenBy: ANA,
    };
    const queued = (override: { overrideTonnes: string | null; overrideExplanation: string | null }) =>
      linesOf({
        served: [overridden],
        committed: {},
        pending: [{ lineId: 'a', line: { siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '510', unitCode: 'm3', ...override } }],
      })[0];

    it('keeps the person while the override the line carries is the one already stored', () => {
      expect(queued({ overrideTonnes: '0.84', overrideExplanation: 'One van was sub-leased' })?.overriddenBy).toEqual(ANA);
    });

    it('names no one for a changed override until the server says who made it', () => {
      expect(queued({ overrideTonnes: '0.84', overrideExplanation: 'Two vans were sub-leased' })?.overriddenBy).toBeNull();
      expect(queued({ overrideTonnes: '0.9', overrideExplanation: 'One van was sub-leased' })?.overriddenBy).toBeNull();
      expect(queued({ overrideTonnes: null, overrideExplanation: null })?.overriddenBy).toBeNull();
    });
  });
});
