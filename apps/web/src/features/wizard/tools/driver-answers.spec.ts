import { DISCLOSURE_STATE, type DisclosureValueResponse } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { driverAnswersKey } from './driver-answers';

/** Which acknowledged writes read the step again — a follow-on's question's (task 80.1). */
describe('driverAnswersKey', () => {
  const committed = (elementKey: string, over: Partial<DisclosureValueResponse> = {}) =>
    ({
      elementKey,
      dimensionKey: '',
      ordinal: 0,
      valueBoolean: null,
      valueText: null,
      valueNumeric: null,
      state: DISCLOSURE_STATE.OK,
      ...over,
    }) as DisclosureValueResponse;
  const drivers = new Set(['PubliclyAvailableDisclosure']);

  it('moves when a driving field’s stored answer does, and not for any other field', () => {
    const before = driverAnswersKey({ committed: {}, drivers });
    const other = driverAnswersKey({ committed: { a: committed('AmountOfEmissionToAir', { valueNumeric: '3' }) }, drivers });
    const yes = driverAnswersKey({ committed: { p: committed('PubliclyAvailableDisclosure', { valueBoolean: true }) }, drivers });
    const no = driverAnswersKey({ committed: { p: committed('PubliclyAvailableDisclosure', { valueBoolean: false }) }, drivers });
    expect(other).toBe(before);
    expect(yes).not.toBe(before);
    expect(no).not.toBe(yes);
  });

  it('reads the same answers as the same key, whatever order they were acknowledged in', () => {
    const both = new Set(['A', 'B']);
    const a = committed('A', { valueBoolean: true });
    const b = committed('B', { valueText: 'vsme:OtherContentMember' });
    expect(driverAnswersKey({ committed: { a, b }, drivers: both })).toBe(driverAnswersKey({ committed: { b, a }, drivers: both }));
  });

  it('is empty on a step with no driving field', () => {
    expect(driverAnswersKey({ committed: { p: committed('PubliclyAvailableDisclosure') }, drivers: new Set() })).toBe('');
  });
});
