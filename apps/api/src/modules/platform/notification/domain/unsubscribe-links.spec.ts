import { unsubscribeLinks } from './unsubscribe-links';

/** FR-169's two addresses (task 52.2.2): S-38 in the reader's language, and RFC 8058's target outside it. */
describe('unsubscribeLinks (task 52.2.2)', () => {
  it('opens S-38 in the recipient’s language and posts one-click outside the locale routing', () => {
    expect(unsubscribeLinks({ origin: 'https://app.easyesg.md', token: 'v1~abc~def', locale: 'ru' })).toEqual({
      link: 'https://app.easyesg.md/ru/unsubscribe/v1~abc~def',
      oneClickUrl: 'https://app.easyesg.md/mail/unsubscribe/v1~abc~def',
    });
  });
});
