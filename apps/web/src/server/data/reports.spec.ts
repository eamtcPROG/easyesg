import { beforeEach, describe, expect, it, vi } from 'vitest';

// Throws outside a React Server environment by design; `wizard.spec.ts` records the same.
vi.mock('server-only', () => ({}));

// `vi.hoisted` because `vi.mock` is hoisted above the imports: a bare `const` above it is still in
// the temporal dead zone when the factory runs. Typed, so the mock cannot drift from the seam it
// stands in for — `unknown[]` plus a spread was the first draft and returned `any`.
const { getList } = vi.hoisted(() => ({
  getList: vi.fn<(path: string) => Promise<unknown>>(),
}));

vi.mock('../api-client', () => ({ api: { getList } }));

import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { readReportCreation, readReportList } from './reports';
import { TENANT_READ } from './tenant-read';

/**
 * The reports seam (tasks 32.2.2, 32.3).
 *
 * **Written because the gate review deleted this seam's one domain decision and watched 275 tests
 * pass.** The withholding — which periods the creation flow may offer — is the only rule here that
 * is not a pass-through, and both of its causes were unguarded: a period that already carries a
 * report, and one whose period is locked. The e2e seeds a free period, so neither branch had a
 * subject anywhere.
 *
 * The refusal arms are asserted for the same reason: `FORBIDDEN` and `UNREACHABLE` are different
 * screens, and nothing else in the tree tells them apart.
 */
const ok = <T,>(items: readonly T[]) => ({
  status: API_OUTCOME.Ok,
  value: { items, total: items.length },
});

/**
 * **Keyed on the problem TYPE, never the status** — `tenant-read.ts`'s own rule, and the reason this
 * fixture takes one: `401` means both "no session" and "wrong password", and a spec that asserted a
 * status would pass against a seam that had stopped reading the type at all.
 */
const refusal = (type: string) => ({
  status: API_OUTCOME.Problem,
  problem: { status: 403, type, title: 'no' },
});

const unreachable = { status: API_OUTCOME.Unreachable } as const;

const period = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  reportingEntityId: 'e1',
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
  periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
  dueDate: null,
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  priorPeriodId: null,
  entitySnapshotId: null,
  lockedAt: null,
  lockedBy: null,
  createdAt: 1,
  updatedAt: 2,
  ...over,
});

const report = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  reportingPeriodId: 'p1',
  scope: 'basic',
  status: 'open',
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  createdAt: 1,
  updatedAt: 2,
  subject: {
    reportingEntityId: 'e1',
    entityName: 'Aurora SRL',
    fiscalYear: 2026,
    periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
    periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
    dueDate: null,
  },
  ...over,
});

beforeEach(() => {
  getList.mockReset();
});

describe('readReportList', () => {
  it('answers rows for a member', async () => {
    getList.mockResolvedValueOnce(ok([report()]));
    const read = await readReportList();

    expect(read.status).toBe(TENANT_READ.READY);
    expect(read.status === TENANT_READ.READY && read.rows[0].entityName).toBe('Aurora SRL');
  });

  /** A 403 is a different screen from a network failure — one names a boundary, one offers a retry. */
  it('tells a permission refusal apart from an unreachable service', async () => {
    getList.mockResolvedValueOnce(refusal(PROBLEM_TYPE.InsufficientRole));
    expect((await readReportList()).status).toBe(TENANT_READ.FORBIDDEN);

    // The second permission cause: several memberships and no stated preference resolves no
    // organization, so a `@RequiresRole` route answers `membership-required` rather than a role
    // refusal — one fact to the reader, and both must reach the same screen.
    getList.mockResolvedValueOnce(refusal(PROBLEM_TYPE.MembershipRequired));
    expect((await readReportList()).status).toBe(TENANT_READ.FORBIDDEN);

    // Any other problem is not a boundary — it is a failure with a retry. Asserted with a type
    // that is real and is NOT in the permission list, so the negative half cannot pass by typo.
    getList.mockResolvedValueOnce(refusal(PROBLEM_TYPE.AccountLocked));
    expect((await readReportList()).status).toBe(TENANT_READ.UNREACHABLE);

    getList.mockResolvedValueOnce(unreachable);
    expect((await readReportList()).status).toBe(TENANT_READ.UNREACHABLE);
  });
});

describe('readReportCreation', () => {
  it('offers the entities alphabetically and asks for no periods until one is chosen', async () => {
    getList.mockResolvedValueOnce(
      ok([
        { id: 'e2', name: 'Zorile SRL' },
        { id: 'e1', name: 'Aurora SRL' },
      ]),
    );

    const read = await readReportCreation();

    expect(read.status).toBe(TENANT_READ.READY);
    expect(read.status === TENANT_READ.READY && read.entities.map((e) => e.name)).toEqual([
      'Aurora SRL',
      'Zorile SRL',
    ]);
    // One request, not three: `GET /periods` is scoped to an entity, so there is nothing to ask yet.
    expect(getList).toHaveBeenCalledTimes(1);
  });

  /**
   * **The withholding, both causes.** A period holds at most one report, and `CreateReport` refuses
   * a locked one outright (FR-26, UC-18) — so offering either would put a refusal behind a control
   * that looked available. Deleting one filter or the other must fail here; before this spec, both
   * could be deleted with the whole suite green.
   */
  it('withholds a period that already has a report, and one that is locked', async () => {
    getList
      .mockResolvedValueOnce(ok([{ id: 'e1', name: 'Aurora SRL' }]))
      .mockResolvedValueOnce(
        ok([
          period({ id: 'free' }),
          period({ id: 'taken' }),
          period({ id: 'locked', lockedAt: 1_787_000_000_000 }),
        ]),
      )
      .mockResolvedValueOnce(ok([report({ reportingPeriodId: 'taken' })]));

    const read = await readReportCreation('e1');

    expect(read.status).toBe(TENANT_READ.READY);
    expect(read.status === TENANT_READ.READY && read.periods.map((p) => p.id)).toEqual(['free']);
  });

  it('offers nothing where every period of the entity is spoken for', async () => {
    getList
      .mockResolvedValueOnce(ok([{ id: 'e1', name: 'Aurora SRL' }]))
      .mockResolvedValueOnce(ok([period({ id: 'taken' })]))
      .mockResolvedValueOnce(ok([report({ reportingPeriodId: 'taken' })]));

    const read = await readReportCreation('e1');
    expect(read.status === TENANT_READ.READY && read.periods).toEqual([]);
  });

  /**
   * **"This entity has no free period" and "we could not ask" are different answers**, and only one
   * of them is the reader's to act on — so a failed period read is `UNREACHABLE`, never an empty
   * offer, however well the entities read went.
   */
  it('reports unreachable when the entities arrived and the periods did not', async () => {
    getList
      .mockResolvedValueOnce(ok([{ id: 'e1', name: 'Aurora SRL' }]))
      .mockResolvedValueOnce(unreachable)
      .mockResolvedValueOnce(ok([]));

    expect((await readReportCreation('e1')).status).toBe(TENANT_READ.UNREACHABLE);
  });

  it('reports a permission refusal from the entities read', async () => {
    getList.mockResolvedValueOnce(refusal(PROBLEM_TYPE.InsufficientRole));
    expect((await readReportCreation()).status).toBe(TENANT_READ.FORBIDDEN);
  });
});
