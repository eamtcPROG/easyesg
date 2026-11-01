import { SUPPORT_ACCESS_GRANT_MS } from '../domain/support-access-request';
import { SupportAccessRequiredError } from '../errors/support-access.errors';
import { FakeGrantedReads } from '../testing/granted-reads.fake';
import { ReadUnderSupportAccess } from './read-under-support-access.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('ReadUnderSupportAccess (task 67.9; FR-77 … FR-79)', () => {
  let reads: FakeGrantedReads;
  let now: Date;
  let underGrant: ReadUnderSupportAccess;

  const command = (overrides: { operatorId?: string; read?: () => Promise<string> } = {}) => ({
    operatorId: overrides.operatorId ?? 'operator-1',
    organizationId: 'organization-1',
    requestId: 'request-1',
    purpose: 'report_module' as const,
    subject: 'report-1/B3',
    read:
      overrides.read ??
      (() => {
        reads.events.push('read');
        return Promise.resolve('the module');
      }),
  });

  const grant = () =>
    reads.decisions.push({
      requestId: 'request-1',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + MINUTE),
    });

  beforeEach(() => {
    reads = new FakeGrantedReads();
    reads.requests.push({
      id: 'request-1',
      organizationId: 'organization-1',
      requesterId: 'operator-1',
      requesterEmail: null,
      ticketReference: 'SUP-1',
      reason: 'why',
      requestedAt: start,
    });
    now = new Date(start.getTime() + 5 * MINUTE);
    underGrant = new ReadUnderSupportAccess(reads, () => now);
  });

  it('binds the organization, logs the access, then reads — in that order', async () => {
    grant();
    await expect(underGrant.execute(command())).resolves.toBe('the module');

    expect(reads.events).toEqual(['bound:organization-1', 'access', 'read']);
    expect(reads.accesses).toEqual([{ requestId: 'request-1', purpose: 'report_module', subject: 'report-1/B3' }]);
  });

  it('refuses a request the organization has not granted, and reads nothing', async () => {
    await expect(underGrant.execute(command())).rejects.toBeInstanceOf(SupportAccessRequiredError);
    expect(reads.events).toEqual(['bound:organization-1']);
  });

  it('refuses another Platform Administrator — a grant is given to the operator who asked', async () => {
    grant();
    await expect(underGrant.execute(command({ operatorId: 'operator-2' }))).rejects.toBeInstanceOf(
      SupportAccessRequiredError,
    );
    expect(reads.accesses).toEqual([]);
  });

  it('refuses once the 60 minutes have run out, with no action taken (FR-78)', async () => {
    grant();
    now = new Date(start.getTime() + MINUTE + SUPPORT_ACCESS_GRANT_MS);
    await expect(underGrant.execute(command())).rejects.toBeInstanceOf(SupportAccessRequiredError);
  });

  it('refuses an unknown request with the same answer', async () => {
    reads.requests.length = 0;
    await expect(underGrant.execute(command())).rejects.toBeInstanceOf(SupportAccessRequiredError);
  });

  it('never reads when the access could not be logged', async () => {
    grant();
    reads.failAccessWrite = true;
    await expect(underGrant.execute(command())).rejects.toThrow('the access row could not be written');
    expect(reads.events).not.toContain('read');
  });
});
