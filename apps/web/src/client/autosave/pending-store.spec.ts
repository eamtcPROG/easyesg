import { DISCLOSURE_STATE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { memoryPendingWriteStore, storedQueue, storedSetAside } from './pending-store';

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

/** Task 218: what was set aside reads back with its reason, or not at all — never as a key the queue would trust. */
describe('storedSetAside', () => {
  const write = { elementKey: 'AmountOfEmissionToAir', dimensionKey: 'AlachlorMember', state: DISCLOSURE_STATE.OK };
  const item = {
    key: 'AmountOfEmissionToAir\u0000AlachlorMember\u00000',
    write,
    refusal: { detail: 'Refused.', label: 'Emissions to air', memberLabel: null, modules: ['B4'] },
  };

  it('reads back a set-aside item with its write and its reason', () => {
    expect(storedSetAside([item])).toEqual([item]);
  });

  it('reads back nothing where an item is not one it knows', () => {
    expect(storedSetAside([item, { ...item, write: { something: 'else' } }])).toEqual([]);
    expect(storedSetAside([{ ...item, refusal: { ...item.refusal, modules: 'B4' } }])).toEqual([]);
    expect(storedSetAside(undefined)).toEqual([]);
  });

  it('keeps it apart from the queue of the same scope', async () => {
    const store = memoryPendingWriteStore();
    await store.save('a/r1', [write]);
    await store.saveSetAside('a/r1', [item]);
    expect(await store.load('a/r1')).toEqual([write]);
    expect(await store.loadSetAside('a/r1')).toEqual([item]);
    await store.saveSetAside('a/r1', []);
    expect(await store.loadSetAside('a/r1')).toEqual([]);
    expect(await store.load('a/r1')).toEqual([write]);
  });
});
