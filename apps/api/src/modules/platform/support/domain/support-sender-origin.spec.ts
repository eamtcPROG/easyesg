import { SUPPORT_SENDER_ORIGIN, supportSenderOrigin } from './support-sender-origin';

describe('supportSenderOrigin (task 77)', () => {
  it.each([
    [{ accountId: 'a', organizationName: 'Grupul Lina' }, SUPPORT_SENDER_ORIGIN.ORGANIZATION],
    [{ accountId: 'a', organizationName: null }, SUPPORT_SENDER_ORIGIN.ACCOUNT],
    [{ accountId: null, organizationName: null }, SUPPORT_SENDER_ORIGIN.VISITOR],
  ])('words %j as %s', (sender, origin) => {
    expect(supportSenderOrigin({ name: 'Ana', email: 'ana@lina.md', ...sender })).toBe(origin);
  });
});
