import { SUPPORT_ACCESS_GRANT_MS, SUPPORT_ACCESS_LAPSE_MS } from '../domain/support-access-request';
import {
  SupportAccessOrganizationNotFoundError,
  SupportAccessOutstandingError,
} from '../errors/support-access.errors';
import { FakeSupportAccessLedger } from '../testing/support-access-ledger.fake';
import { RaiseSupportAccessRequest } from './raise-support-access-request.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('RaiseSupportAccessRequest (task 67.9; UC-85)', () => {
  let ledger: FakeSupportAccessLedger;
  let now: Date;
  let raise: RaiseSupportAccessRequest;

  const command = { operatorId: 'operator-1', organizationId: 'organization-1', ticketReference: 'SUP-1', reason: 'why' };

  beforeEach(() => {
    ledger = new FakeSupportAccessLedger();
    ledger.organizations.add('organization-1');
    now = start;
    raise = new RaiseSupportAccessRequest(ledger, () => now);
  });

  it('records a request and grants nothing — the organization answers it', async () => {
    const raised = await raise.execute(command);

    expect(raised).toEqual({
      id: 'request-1',
      organizationId: 'organization-1',
      requestedAt: start,
      lapsesAt: new Date(start.getTime() + SUPPORT_ACCESS_LAPSE_MS),
    });
    expect(ledger.requests).toEqual([
      expect.objectContaining({ id: 'request-1', requesterId: 'operator-1', ticketReference: 'SUP-1', reason: 'why' }),
    ]);
    expect(ledger.decisions).toEqual([]);
  });

  it('refuses an organization that does not exist, and records nothing', async () => {
    await expect(raise.execute({ ...command, organizationId: 'nobody' })).rejects.toBeInstanceOf(
      SupportAccessOrganizationNotFoundError,
    );
    expect(ledger.requests).toEqual([]);
  });

  it('refuses a second request while the first still waits, and while a grant runs', async () => {
    await raise.execute(command);
    now = new Date(start.getTime() + MINUTE);
    await expect(raise.execute(command)).rejects.toBeInstanceOf(SupportAccessOutstandingError);

    ledger.decisions.push({
      requestId: 'request-1',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + 2 * MINUTE),
    });
    now = new Date(start.getTime() + 3 * MINUTE);
    await expect(raise.execute(command)).rejects.toBeInstanceOf(SupportAccessOutstandingError);
    expect(ledger.requests).toHaveLength(1);
  });

  it('accepts a new request once the grant ran out — the owner’s extension', async () => {
    await raise.execute(command);
    ledger.decisions.push({
      requestId: 'request-1',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + MINUTE),
    });
    now = new Date(start.getTime() + MINUTE + SUPPORT_ACCESS_GRANT_MS);

    await expect(raise.execute(command)).resolves.toMatchObject({ id: 'request-2' });
  });

  it('lets another operator ask the same organization while one request is open', async () => {
    await raise.execute(command);
    await expect(raise.execute({ ...command, operatorId: 'operator-2' })).resolves.toMatchObject({
      id: 'request-2',
    });
  });
});
