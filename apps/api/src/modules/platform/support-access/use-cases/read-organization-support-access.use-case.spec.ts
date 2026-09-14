import { FakeOrganizationSupportAccessStore } from '../testing/organization-support-access-store.fake';
import { ReadOrganizationSupportAccess } from './read-organization-support-access.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('ReadOrganizationSupportAccess (task 67.9; UX-124)', () => {
  let store: FakeOrganizationSupportAccessStore;
  let read: ReadOrganizationSupportAccess;
  const now = new Date(start.getTime() + 10 * MINUTE);

  const request = (id: string, minutesAfterStart: number) => ({
    id,
    organizationId: 'organization-1',
    requesterId: 'operator-1',
    requesterEmail: 'ana@easyesg.md',
    ticketReference: `SUP-${id}`,
    reason: 'why',
    requestedAt: new Date(start.getTime() + minutesAfterStart * MINUTE),
  });

  beforeEach(() => {
    store = new FakeOrganizationSupportAccessStore('organization-1');
    store.requests.push(request('waiting', 5), request('running', 1));
    store.decisions.push({
      requestId: 'running',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + 2 * MINUTE),
    });
    read = new ReadOrganizationSupportAccess(store, () => now);
  });

  it('shows an Organization Administrator what waits for an answer and what runs', async () => {
    const shown = await read.execute({ role: 'organization_administrator' });

    expect(shown.awaiting.map((entry) => entry.id)).toEqual(['waiting']);
    expect(shown.active).toMatchObject({ id: 'running', state: 'active', requesterEmail: 'ana@easyesg.md' });
  });

  it('shows every other member running access only — the question is not theirs to answer', async () => {
    for (const role of ['editor', 'viewer'] as const) {
      const shown = await read.execute({ role });
      expect(shown.awaiting).toEqual([]);
      expect(shown.active).toMatchObject({ id: 'running' });
    }
  });

  it('shows nothing running once the grant is over', async () => {
    store.decisions.push({
      requestId: 'running',
      kind: 'end',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + 3 * MINUTE),
    });
    expect((await read.execute({ role: 'viewer' })).active).toBeNull();
  });
});
