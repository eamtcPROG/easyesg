import { DISCLOSURE_STATE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { storedQueue } from './pending-store';

/**
 * What a durable queue reads back as (tasks 35.2, 39.1). Every shape the queue carries must survive a reload — the
 * case FR-38 names, a tab closed with changes still unsent.
 */
describe('storedQueue', () => {
  const value = { elementKey: 'NumberOfEmployees', valueNumeric: '42', state: DISCLOSURE_STATE.OK };
  const input = { inputKey: 'TotalHoursWorked', valueNumeric: '1800' };
  const line = { lineId: 'line-1', line: { siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '500', unitCode: 'm3' } };
  const removal = { lineId: 'line-2', removed: true };

  it('reads back every shape the queue carries, together', () => {
    // A derivation input in the list emptied the whole queue until task 39.1: the check read `elementKey` alone.
    expect(storedQueue([value, input, line, removal])).toEqual([value, input, line, removal]);
  });

  it('reads back nothing from a list holding a shape it does not recognise, rather than sending it', () => {
    expect(storedQueue([value, { something: 'else' }])).toEqual([]);
    expect(storedQueue([{ lineId: 'line-3' }])).toEqual([]);
    expect(storedQueue('not a list')).toEqual([]);
    expect(storedQueue(undefined)).toEqual([]);
  });
});
