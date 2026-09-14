import {
  SupportAccessNotActiveError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import { FakeOrganizationSupportAccessStore } from '../testing/organization-support-access-store.fake';
import { EndSupportAccessAsOrganization } from './end-support-access-as-organization.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('EndSupportAccessAsOrganization (task 67.9; UC-85 3a, UX-124)', () => {
  let store: FakeOrganizationSupportAccessStore;
  let end: EndSupportAccessAsOrganization;
  const now = new Date(start.getTime() + 10 * MINUTE);

  beforeEach(() => {
    store = new FakeOrganizationSupportAccessStore('organization-1');
    store.requests.push({
      id: 'request-1',
      organizationId: 'organization-1',
      requesterId: 'operator-1',
      requesterEmail: null,
      ticketReference: 'SUP-1',
      reason: 'why',
      requestedAt: start,
    });
    end = new EndSupportAccessAsOrganization(store, () => now);
  });

  it('lets any Organization Administrator withdraw a grant they did not give', async () => {
    store.decisions.push({
      requestId: 'request-1',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + MINUTE),
    });

    await end.execute({ requestId: 'request-1', actorId: 'member-2' });

    expect(store.locked).toEqual(['request-1']);
    expect(store.decisions.at(-1)).toMatchObject({ kind: 'end', actorId: 'member-2', actorRealm: 'organization' });
  });

  it('refuses to end access that is not running', async () => {
    await expect(end.execute({ requestId: 'request-1', actorId: 'member-1' })).rejects.toBeInstanceOf(
      SupportAccessNotActiveError,
    );
  });

  it('refuses an unknown request', async () => {
    await expect(end.execute({ requestId: 'request-9', actorId: 'member-1' })).rejects.toBeInstanceOf(
      SupportAccessRequestNotFoundError,
    );
  });
});
