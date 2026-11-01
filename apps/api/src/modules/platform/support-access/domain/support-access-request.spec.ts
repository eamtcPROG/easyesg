import type {
  SupportAccessDecisionRecord,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';
import {
  SUPPORT_ACCESS_GRANT_MS,
  SUPPORT_ACCESS_LAPSE_MS,
  supportAccessIsOutstanding,
  supportAccessRequestOf,
} from './support-access-request';

/**
 * The fold every support-access decision rests on (task 67.9). States and kinds are asserted as their
 * wire literals, the root file's test exception: a renamed value must break here.
 */
const MINUTE = 60 * 1000;
const requestedAt = new Date('2026-09-14T09:00:00.000Z');
const later = (ms: number) => new Date(requestedAt.getTime() + ms);

const request: SupportAccessRequestRecord = {
  id: 'request-1',
  organizationId: 'organization-1',
  requesterId: 'operator-1',
  requesterEmail: 'ana@easyesg.md',
  ticketReference: 'SUP-4417',
  reason: 'Scope 2 missing after recalculation',
  requestedAt,
};

const row = (
  kind: SupportAccessDecisionRecord['kind'],
  at: Date,
  overrides: Partial<SupportAccessDecisionRecord> = {},
): SupportAccessDecisionRecord => ({
  requestId: request.id,
  kind,
  actorId: 'member-1',
  actorRealm: 'organization',
  actorEmail: 'owner@company.md',
  occurredAt: at,
  ...overrides,
});

const fold = (decisions: SupportAccessDecisionRecord[], now: Date) =>
  supportAccessRequestOf({ request, decisions, now });

describe('supportAccessRequestOf', () => {
  it('waits 24 hours for an answer, and lapses on the instant they run out', () => {
    expect(fold([], later(SUPPORT_ACCESS_LAPSE_MS - 1)).state).toBe('awaiting');
    expect(fold([], later(SUPPORT_ACCESS_LAPSE_MS)).state).toBe('lapsed');
    expect(fold([], requestedAt).lapsesAt).toEqual(later(SUPPORT_ACCESS_LAPSE_MS));
  });

  it('runs a grant for 60 minutes from the grant, not from the request, then expires it', () => {
    const granted = row('grant', later(30 * MINUTE));
    const running = fold([granted], later(30 * MINUTE + SUPPORT_ACCESS_GRANT_MS - 1));
    expect(running.state).toBe('active');
    expect(running.expiresAt).toEqual(later(30 * MINUTE + SUPPORT_ACCESS_GRANT_MS));
    expect(running.decision).toBe(granted);
    expect(fold([granted], later(30 * MINUTE + SUPPORT_ACCESS_GRANT_MS)).state).toBe('expired');
  });

  it('keeps a decline declined, with no expiry', () => {
    const declined = fold([row('decline', later(MINUTE))], later(2 * MINUTE));
    expect(declined.state).toBe('declined');
    expect(declined.expiresAt).toBeNull();
  });

  it('ends a live grant on an end from either realm', () => {
    const granted = row('grant', later(MINUTE));
    const byOrganization = row('end', later(10 * MINUTE));
    const byPlatform = row('end', later(10 * MINUTE), { actorId: 'operator-2', actorRealm: 'platform' });

    expect(fold([granted, byOrganization], later(11 * MINUTE))).toMatchObject({
      state: 'ended',
      ended: byOrganization,
    });
    expect(fold([granted, byPlatform], later(11 * MINUTE)).state).toBe('ended');
  });

  it('lets the first answer win, whatever order the rows arrive in', () => {
    const first = row('decline', later(MINUTE), { actorId: 'member-1' });
    const second = row('grant', later(2 * MINUTE), { actorId: 'member-2' });
    expect(fold([second, first], later(3 * MINUTE))).toMatchObject({ state: 'declined', decision: first });
  });

  it('ignores an answer that came after the request lapsed', () => {
    const tooLate = row('grant', later(SUPPORT_ACCESS_LAPSE_MS + MINUTE));
    expect(fold([tooLate], later(SUPPORT_ACCESS_LAPSE_MS + 2 * MINUTE))).toMatchObject({
      state: 'lapsed',
      decision: null,
    });
  });

  it('counts an end only while the grant is live — not before it, not after it', () => {
    const early = row('end', later(MINUTE));
    const granted = row('grant', later(2 * MINUTE));
    const afterExpiry = row('end', later(2 * MINUTE + SUPPORT_ACCESS_GRANT_MS + MINUTE));

    expect(fold([early, granted], later(3 * MINUTE))).toMatchObject({ state: 'active', ended: null });
    expect(
      fold([granted, afterExpiry], later(2 * MINUTE + SUPPORT_ACCESS_GRANT_MS + 2 * MINUTE)),
    ).toMatchObject({ state: 'expired', ended: null });
  });

  it('reads only its own request’s rows', () => {
    const elsewhere = row('grant', later(MINUTE), { requestId: 'request-2' });
    expect(fold([elsewhere], later(2 * MINUTE)).state).toBe('awaiting');
  });
});

describe('supportAccessIsOutstanding', () => {
  it('holds the operator’s place while waiting or running, and not after', () => {
    const granted = row('grant', later(MINUTE));
    expect(supportAccessIsOutstanding(fold([], later(MINUTE)))).toBe(true);
    expect(supportAccessIsOutstanding(fold([granted], later(2 * MINUTE)))).toBe(true);
    expect(supportAccessIsOutstanding(fold([row('decline', later(MINUTE))], later(2 * MINUTE)))).toBe(false);
    expect(supportAccessIsOutstanding(fold([], later(SUPPORT_ACCESS_LAPSE_MS)))).toBe(false);
  });
});
