import { assertQueueableKey, isQueueableKey } from './queueable-key';

/** Task 206: the keys a queue job id cannot be, and the natural keys the producers write, which it must admit. */
describe('isQueueableKey', () => {
  it.each([
    'identity.email_verification.requested/0192f000-0000-7000-8000-000000000001/1790726400000',
    'validation.report_notice_sweep/2026-10-09',
    '0192f000-0000-7000-8000-000000000001',
    'order-42-invoice',
    // A number that names its kind, which is what the refusal of a bare number asks a natural key to do.
    'invoice/0042',
  ])('admits %s', (key) => {
    expect(isQueueableKey(key)).toBe(true);
  });

  it.each([
    // The three-part legacy form BullMQ 6 still admits, and the two-part form it already refuses.
    ['a colon in three parts', 'identity.invitation.issued:invitation-1:1790726400000'],
    ['a colon in two parts', 'validation.report_notice_sweep:2026-10-09'],
    ['a number', '42'],
    ['a signed number', '-42'],
    // BullMQ itself would admit this one; refused anyway, since it reads as a number to a person (task-206 row (2)).
    ['a number with leading zeros', '0042'],
    ['nothing', ''],
  ])('refuses %s', (_case, key) => {
    expect(isQueueableKey(key)).toBe(false);
  });
});

describe('assertQueueableKey', () => {
  it('names the key it refuses', () => {
    expect(() => assertQueueableKey('a:b')).toThrow(/'a:b'/u);
  });

  it('passes a key the queue can take', () => {
    expect(() => assertQueueableKey('a/b')).not.toThrow();
  });
});
