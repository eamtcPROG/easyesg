import { DELIVERY_OUTCOME, isDispatch, type DeliveryOutcome } from './notification-record.model';

/**
 * Which delivery outcomes NFR-106 times (task 202; §12.5.6's task-202 row (4)). **Every member is listed**, as the wire
 * value it stores, so an outcome added to the vocabulary fails here until someone states whether it is a dispatch.
 */
describe('isDispatch (task 202)', () => {
  const verdicts: Record<DeliveryOutcome, boolean> = {
    delivered: true,
    accepted: true,
    bounced: true,
    suppressed: false,
    opted_out: false,
  };

  it('states a verdict for every outcome the vocabulary holds', () => {
    expect(Object.keys(verdicts).sort()).toEqual(Object.values(DELIVERY_OUTCOME).sort());
  });

  it.each(Object.entries(verdicts))('%s is a dispatch: %s', (outcome, expected) => {
    expect(isDispatch(outcome as DeliveryOutcome)).toBe(expected);
  });
});
