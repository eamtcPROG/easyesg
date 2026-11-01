import { supportRequestThrottleKey } from './support-request-throttle';

describe('supportRequestThrottleKey (FR-212 behaviour 4; task 77)', () => {
  it('keys a signed-in reader by the account and a visitor by the address, never by where they came from', () => {
    expect(supportRequestThrottleKey({ accountId: '0192f000-0000-7000-8000-000000000001' })).toBe(
      'support-request:account/0192f000-0000-7000-8000-000000000001',
    );
    expect(supportRequestThrottleKey({ email: 'Ana@Lina.md' })).toBe('support-request:address/ana@lina.md');
  });

  it('gives one address one window however it is cased', () => {
    expect(supportRequestThrottleKey({ email: 'ANA@lina.md' })).toBe(supportRequestThrottleKey({ email: 'ana@LINA.md' }));
  });
});
