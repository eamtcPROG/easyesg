import { SUPPORT_ACCESS_LAPSE_MS } from '../domain/support-access-request';
import {
  SupportAccessNotAwaitingError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import { FakeOrganizationSupportAccessStore } from '../testing/organization-support-access-store.fake';
import { AnswerSupportAccessRequest } from './answer-support-access-request.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('AnswerSupportAccessRequest (task 67.9; UC-85, FR-78)', () => {
  let store: FakeOrganizationSupportAccessStore;
  let now: Date;
  let answer: AnswerSupportAccessRequest;

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
    now = new Date(start.getTime() + MINUTE);
    answer = new AnswerSupportAccessRequest(store, () => now);
  });

  it('records the grant as the answering member’s, after holding the request', async () => {
    await answer.execute({ requestId: 'request-1', actorId: 'member-1', answer: 'grant' });

    expect(store.locked).toEqual(['request-1']);
    expect(store.decisions).toEqual([
      expect.objectContaining({ requestId: 'request-1', kind: 'grant', actorId: 'member-1', actorRealm: 'organization', occurredAt: now }),
    ]);
  });

  it('records a decline the same way', async () => {
    await answer.execute({ requestId: 'request-1', actorId: 'member-1', answer: 'decline' });
    expect(store.decisions.map((row) => row.kind)).toEqual(['decline']);
  });

  it('refuses a second answer — the first administrator’s stands', async () => {
    await answer.execute({ requestId: 'request-1', actorId: 'member-1', answer: 'decline' });
    await expect(
      answer.execute({ requestId: 'request-1', actorId: 'member-2', answer: 'grant' }),
    ).rejects.toBeInstanceOf(SupportAccessNotAwaitingError);
    expect(store.decisions).toHaveLength(1);
  });

  it('refuses an answer after the request lapsed', async () => {
    now = new Date(start.getTime() + SUPPORT_ACCESS_LAPSE_MS);
    await expect(
      answer.execute({ requestId: 'request-1', actorId: 'member-1', answer: 'grant' }),
    ).rejects.toBeInstanceOf(SupportAccessNotAwaitingError);
  });

  it('refuses a request of another organization as no request at all', async () => {
    store.requests[0] = { ...store.requests[0], organizationId: 'organization-2' };
    await expect(
      answer.execute({ requestId: 'request-1', actorId: 'member-1', answer: 'grant' }),
    ).rejects.toBeInstanceOf(SupportAccessRequestNotFoundError);
  });
});
