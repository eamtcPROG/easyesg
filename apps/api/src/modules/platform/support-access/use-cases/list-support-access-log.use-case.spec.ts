import type {
  SupportAccessLogReader,
  SupportAccessLogRows,
} from '../interfaces/support-access-log-reader.interface';
import { ListSupportAccessLog } from './list-support-access-log.use-case';

const MINUTE = 60 * 1000;
const start = new Date('2026-09-14T09:00:00.000Z');

describe('ListSupportAccessLog (task 67.9; UC-86, FR-79)', () => {
  const rows: SupportAccessLogRows = {
    requests: [
      {
        id: 'granted',
        organizationId: 'organization-1',
        organizationName: 'Lactate Nord SA',
        requesterId: 'operator-1',
        requesterEmail: 'ana@easyesg.md',
        ticketReference: 'SUP-4417',
        reason: 'Scope 2 missing',
        requestedAt: new Date(start.getTime() + MINUTE),
      },
      {
        id: 'waiting',
        organizationId: 'organization-2',
        organizationName: 'Agro-Prut Group SRL',
        requesterId: 'operator-2',
        requesterEmail: 'mihai@easyesg.md',
        ticketReference: 'SUP-4402',
        reason: 'Cannot add a fourth entity',
        requestedAt: start,
      },
    ],
    decisions: [
      {
        requestId: 'granted',
        kind: 'grant',
        actorId: 'member-1',
        actorRealm: 'organization',
        actorEmail: 'owner@lactate.md',
        occurredAt: new Date(start.getTime() + 2 * MINUTE),
      },
    ],
    accesses: [
      { requestId: 'granted', purpose: 'reports', subject: null, occurredAt: new Date(start.getTime() + 3 * MINUTE) },
    ],
    total: 2,
  };

  it('folds each request’s state at the instant of the read, with its accesses and names', async () => {
    const asked: unknown[] = [];
    const reader: SupportAccessLogReader = {
      list: (read) => {
        asked.push(read);
        return Promise.resolve(rows);
      },
    };
    const list = new ListSupportAccessLog(reader, () => new Date(start.getTime() + 4 * MINUTE));

    const page = await list.execute({ requesterId: 'operator-3', take: 50, skip: 0 });

    expect(asked).toEqual([{ requesterId: 'operator-3', take: 50, skip: 0 }]);
    expect(page.total).toBe(2);
    expect(page.entries[0]).toMatchObject({
      id: 'granted',
      state: 'active',
      organizationName: 'Lactate Nord SA',
      decision: { actorEmail: 'owner@lactate.md' },
      accesses: [{ purpose: 'reports' }],
    });
    expect(page.entries[1]).toMatchObject({ id: 'waiting', state: 'awaiting', accesses: [] });
  });
});
