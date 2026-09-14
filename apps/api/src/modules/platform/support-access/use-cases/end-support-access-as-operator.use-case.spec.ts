import { SUPPORT_ACCESS_GRANT_MS } from '../domain/support-access-request';
import {
  SupportAccessNotActiveError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import { FakeSupportAccessLedger } from '../testing/support-access-ledger.fake';
import { EndSupportAccessAsOperator } from './end-support-access-as-operator.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('EndSupportAccessAsOperator (task 67.9; UC-85 3a)', () => {
  let ledger: FakeSupportAccessLedger;
  let now: Date;
  let end: EndSupportAccessAsOperator;

  beforeEach(() => {
    ledger = new FakeSupportAccessLedger();
    ledger.requests.push({
      id: 'request-1',
      organizationId: 'organization-1',
      requesterId: 'operator-1',
      requesterEmail: null,
      ticketReference: 'SUP-1',
      reason: 'why',
      requestedAt: start,
    });
    now = new Date(start.getTime() + 5 * MINUTE);
    end = new EndSupportAccessAsOperator(ledger, () => now);
  });

  const grant = () =>
    ledger.decisions.push({
      requestId: 'request-1',
      kind: 'grant',
      actorId: 'member-1',
      actorRealm: 'organization',
      actorEmail: null,
      occurredAt: new Date(start.getTime() + MINUTE),
    });

  it('lets any Platform Administrator end running access — the end names who ended it', async () => {
    grant();
    await end.execute({ operatorId: 'operator-2', organizationId: 'organization-1', requestId: 'request-1' });

    expect(ledger.decisions.at(-1)).toMatchObject({
      kind: 'end',
      actorId: 'operator-2',
      actorRealm: 'platform',
      occurredAt: now,
    });
  });

  it('ends nothing that is not running — a request still waiting, or a grant already over', async () => {
    const command = { operatorId: 'operator-1', organizationId: 'organization-1', requestId: 'request-1' };
    await expect(end.execute(command)).rejects.toBeInstanceOf(SupportAccessNotActiveError);

    grant();
    now = new Date(start.getTime() + MINUTE + SUPPORT_ACCESS_GRANT_MS);
    await expect(end.execute(command)).rejects.toBeInstanceOf(SupportAccessNotActiveError);
    expect(ledger.decisions).toHaveLength(1);
  });

  it('refuses a request id the organization does not hold', async () => {
    await expect(
      end.execute({ operatorId: 'operator-1', organizationId: 'organization-2', requestId: 'request-1' }),
    ).rejects.toBeInstanceOf(SupportAccessRequestNotFoundError);
  });
});
