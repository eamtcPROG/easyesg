import { frameOf, hintReaches, readPushHint } from './push-hint';

/** The hint's routing and the frame it becomes (task 148). Literals: the wire values. */
describe('push hints (task 148)', () => {
  const ORG = '0190a4c2-0000-7000-8000-000000000001';
  const OTHER_ORG = '0190a4c2-0000-7000-8000-000000000002';
  const ANA = '0190a4c2-0000-7000-8000-00000000000a';
  const ION = '0190a4c2-0000-7000-8000-00000000000b';
  const since = new Date('2026-09-23T10:00:00Z');

  it('reads an organization-routed hint and an account-routed one, and refuses what it cannot route', () => {
    expect(readPushHint({ event: 'access.changed', organizationId: ORG, accountIds: undefined, since })).toEqual({
      event: 'access.changed',
      organizationId: ORG,
      since,
    });
    expect(
      readPushHint({ event: 'notification.unread_changed', organizationId: ORG, accountIds: [ANA], since }),
    ).toEqual({ event: 'notification.unread_changed', organizationId: ORG, accountIds: [ANA], since });

    expect(readPushHint({ event: 'report.changed', organizationId: ORG, accountIds: undefined, since })).toBeNull();
    expect(readPushHint({ event: 'access.changed', organizationId: 'not-an-id', accountIds: undefined, since })).toBeNull();
    expect(readPushHint({ event: 'notification.unread_changed', organizationId: ORG, accountIds: [], since })).toBeNull();
    expect(
      readPushHint({ event: 'notification.unread_changed', organizationId: ORG, accountIds: ['x'], since }),
    ).toBeNull();
  });

  it('routes an organization hint to members there, and an account hint to the accounts it names', () => {
    const organizational = readPushHint({ event: 'access.changed', organizationId: ORG, accountIds: undefined, since });
    const personal = readPushHint({ event: 'notification.unread_changed', organizationId: ORG, accountIds: [ANA], since });
    if (organizational === null || personal === null) throw new Error('both hints are valid');

    expect(hintReaches(organizational, { accountId: ION, organizationIds: [ORG] })).toBe(true);
    expect(hintReaches(organizational, { accountId: ION, organizationIds: [OTHER_ORG] })).toBe(false);
    expect(hintReaches(personal, { accountId: ANA, organizationIds: [] })).toBe(true);
    expect(hintReaches(personal, { accountId: ION, organizationIds: [ORG] })).toBe(false);
  });

  // AD-15's first constraint, as the frame's shape: the accounts a hint was routed by never reach a browser.
  it('frames exactly the event, the organization and the time — never the accounts', () => {
    const personal = readPushHint({ event: 'notification.unread_changed', organizationId: ORG, accountIds: [ANA], since });
    if (personal === null) throw new Error('the hint is valid');
    const frame = frameOf(personal);

    expect(Object.keys(frame).sort()).toEqual(['event', 'organizationId', 'since']);
    expect(frame).toEqual({ event: 'notification.unread_changed', organizationId: ORG, since: since.getTime() });
  });
});
