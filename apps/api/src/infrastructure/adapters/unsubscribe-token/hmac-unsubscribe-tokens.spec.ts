import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL } from '@api/modules/platform/notification/models/notification-category.model';
import { HmacUnsubscribeTokens } from './hmac-unsubscribe-tokens';

/** FR-169's signed token (task 52.2.2): it names one subject, and nothing but this key can make one. */
describe('HmacUnsubscribeTokens (task 52.2.2)', () => {
  const SECRET = 'a-test-signing-key-that-is-long-enough-to-pass';
  const SUBJECT = {
    accountId: '0192f000-0000-7000-8000-00000000a001',
    categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
    channel: NOTIFICATION_CHANNEL.EMAIL,
  };
  const tokens = new HmacUnsubscribeTokens(SECRET);

  it('reads back the subject it signed', () => {
    expect(tokens.read(tokens.sign(SUBJECT))).toEqual(SUBJECT);
  });

  // No dot anywhere: `apps/web`'s proxy reads a path with a dot as a file and skips the locale routing, so S-38 would
  // answer a 404 (task 52.2.2, found by the browser suite).
  it('is URL-safe and dotless, so it travels in a path segment as it is', () => {
    expect(tokens.sign(SUBJECT)).toMatch(/^v1~[A-Za-z0-9_-]+~[A-Za-z0-9_-]+$/u);
  });

  it('refuses a token signed under another key', () => {
    const other = new HmacUnsubscribeTokens(`${SECRET}-rotated`);
    expect(tokens.read(other.sign(SUBJECT))).toBeNull();
  });

  it('refuses a subject edited under a valid signature', () => {
    const [version, , mac] = tokens.sign(SUBJECT).split('~');
    const forged = Buffer.from(
      JSON.stringify(['0192f000-0000-7000-8000-00000000b002', SUBJECT.categoryKey, SUBJECT.channel]),
    ).toString('base64url');
    expect(tokens.read(`${version}~${forged}~${mac}`)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['one part', 'v1'],
    ['an unknown version', tokens.sign(SUBJECT).replace(/^v1~/u, 'v2~')],
    ['a truncated signature', tokens.sign(SUBJECT).slice(0, -4)],
    ['an overlong token', `v1~${'a'.repeat(600)}~b`],
  ])('answers null, never a throw, for %s', (_case, token) => {
    expect(tokens.read(token)).toBeNull();
  });

  it('answers null for a signed subject naming a category this release does not know', () => {
    const body = Buffer.from(JSON.stringify([SUBJECT.accountId, 'billing.newsletter', 'email'])).toString('base64url');
    // Signed under the real key, the way an older release would have: only the narrowing can refuse it.
    const signed = tokens.sign(SUBJECT).split('~');
    const reSigned = new HmacUnsubscribeTokens(SECRET) as unknown as { mac: (body: string) => Buffer };
    expect(tokens.read(`${signed[0]}~${body}~${reSigned.mac(body).toString('base64url')}`)).toBeNull();
  });

  it('refuses to start without a key long enough to sign with', () => {
    expect(() => new HmacUnsubscribeTokens(undefined)).toThrow('UNSUBSCRIBE_SIGNING_KEY');
    expect(() => new HmacUnsubscribeTokens('short')).toThrow('UNSUBSCRIBE_SIGNING_KEY');
  });
});
