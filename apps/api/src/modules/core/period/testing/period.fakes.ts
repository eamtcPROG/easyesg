import type {
  RegisteredTaxonomy,
  TaxonomyAxis,
  TaxonomyElement,
  TaxonomyPin,
  TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import type { ReportingPeriodStore } from '../interfaces/reporting-period-store.interface';
import type {
  NewReportingPeriod,
  PeriodReopening,
  ReportingPeriod,
  ReportingPeriodPatch,
} from '../models/reporting-period.model';

/**
 * In-memory doubles for the use-case spec — no database, no container (the check
 * `apps/api/CLAUDE.md` names for whether a use case is framework-free).
 *
 * **The store fake models one organization, because RLS does**: the real store takes no organization
 * id anywhere. Cross-tenant behaviour is asserted where it is enforced, in the e2e suite.
 */
/** The zone every fixture is expressed in — Moldova's, which is where these undertakings file. */
const CHISINAU = 'Europe/Chisinau';
/** The adoption task 33.1's `reporting-taxonomy.vsme.json` registers. */
const REGISTERED_VERSION = '2026-05-01';

export const aPeriod = (overrides: Partial<ReportingPeriod> = {}): ReportingPeriod => ({
  id: '00000000-0000-0000-0000-0000000000c1',
  reportingEntityId: '00000000-0000-0000-0000-0000000000b1',
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: CHISINAU },
  periodEnd: { date: '2026-12-31', timezone: CHISINAU },
  dueDate: null,
  templateVersion: REGISTERED_VERSION,
  taxonomyVersion: REGISTERED_VERSION,
  priorPeriodId: null,
  entitySnapshotId: '00000000-0000-0000-0000-0000000000a1',
  lockedAt: null,
  lockedBy: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

// A patch's absent fields are skipped, exactly as the real stores' `if (value === undefined)
// loops do. A plain spread would diverge from what this fake models: a DTO class field declared
// `foo?: T` is an own property set to `undefined` under `useDefineForClassFields`, so spreading one
// erases the stored value instead of leaving it — the defect task 31.1 hit in the use case, where
// nothing modelled it.
const applyPatch = <T extends object>(row: T, patch: Partial<T>): T => {
  const next = { ...row };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
};

export class FakeReportingPeriodStore implements ReportingPeriodStore {
  constructor(private rows: ReportingPeriod[] = []) {}

  /** What the store was asked to pin, so a spec can assert the use case did not choose it. */
  readonly opened: { period: NewReportingPeriod; templateVersion: string; taxonomyVersion: string }[] =
    [];

  get all(): readonly ReportingPeriod[] {
    return this.rows;
  }

  listPeriods(input: { reportingEntityId: string }): Promise<ReportingPeriod[]> {
    return Promise.resolve(this.rows.filter((row) => row.reportingEntityId === input.reportingEntityId));
  }

  findPeriod(input: { periodId: string }): Promise<ReportingPeriod | null> {
    return Promise.resolve(this.rows.find((row) => row.id === input.periodId) ?? null);
  }

  open(input: {
    period: NewReportingPeriod;
    templateVersion: string;
    taxonomyVersion: string;
    at: Date;
  }): Promise<ReportingPeriod> {
    this.opened.push({
      period: input.period,
      templateVersion: input.templateVersion,
      taxonomyVersion: input.taxonomyVersion,
    });
    const created = aPeriod({
      id: `00000000-0000-0000-0000-0000000000c${this.rows.length + 2}`,
      ...input.period,
      templateVersion: input.templateVersion,
      taxonomyVersion: input.taxonomyVersion,
      createdAt: input.at,
      updatedAt: input.at,
    });
    this.rows = [...this.rows, created];
    return Promise.resolve(created);
  }

  private reopenings: PeriodReopening[] = [];

  lock(input: { periodId: string; actorId: string | null; at: Date }): Promise<ReportingPeriod | null> {
    const found = this.rows.find((row) => row.id === input.periodId);
    if (!found) return Promise.resolve(null);
    const locked = { ...found, lockedAt: input.at, lockedBy: input.actorId, updatedAt: input.at };
    this.rows = this.rows.map((row) => (row.id === found.id ? locked : row));
    return Promise.resolve(locked);
  }

  /**
   * **Answers null for a period that is not locked**, matching the real store's conditional
   * `INSERT ... SELECT ... WHERE locked_at IS NOT NULL`. A fake that reopened anything would model
   * behaviour the thing it stands in for does not have — the divergence task 31.1 found in the
   * patch-spread fakes, avoided here rather than rediscovered.
   */
  reopen(input: {
    periodId: string;
    reason: string;
    actorId: string | null;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    const found = this.rows.find((row) => row.id === input.periodId);
    if (!found || found.lockedAt === null) return Promise.resolve(null);
    this.reopenings = [
      {
        id: `00000000-0000-0000-0000-0000000000e${this.reopenings.length + 1}`,
        lockedAt: found.lockedAt,
        reopenedAt: input.at,
        reopenedBy: input.actorId,
        reason: input.reason,
      },
      ...this.reopenings,
    ];
    const reopened = { ...found, lockedAt: null, lockedBy: null, updatedAt: input.at };
    this.rows = this.rows.map((row) => (row.id === found.id ? reopened : row));
    return Promise.resolve(reopened);
  }

  listReopenings(input: { periodId: string }): Promise<PeriodReopening[]> {
    return Promise.resolve(
      this.rows.some((row) => row.id === input.periodId) ? this.reopenings : [],
    );
  }

  update(input: {
    periodId: string;
    patch: ReportingPeriodPatch;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    const found = this.rows.find((row) => row.id === input.periodId);
    if (!found) return Promise.resolve(null);
    const updated = { ...applyPatch(found, input.patch), updatedAt: input.at };
    this.rows = this.rows.map((row) => (row.id === found.id ? updated : row));
    return Promise.resolve(updated);
  }
}

/**
 * A registry answering one adoption. **`pinFor` records what it was asked**, because the use case's
 * most easily broken rule is *which date* it asks about — a backfilled period must pin what was in
 * force then, not what is in force today, and nothing else could observe the difference.
 */
export class FakeTaxonomyRegistry implements TaxonomyRegistry {
  readonly askedFor: (string | undefined)[] = [];

  constructor(private readonly pin: TaxonomyPin | null = {
    standard: 'vsme',
    taxonomyVersion: REGISTERED_VERSION,
    templateVersion: REGISTERED_VERSION,
  }) {}

  pinFor(query: { on?: string }): TaxonomyPin | null {
    this.askedFor.push(query.on);
    return this.pin;
  }

  registeredVersions(): readonly string[] {
    return this.pin ? [this.pin.taxonomyVersion] : [];
  }

  taxonomy(): RegisteredTaxonomy | null {
    return null;
  }

  element(): TaxonomyElement | null {
    return null;
  }

  axis(): TaxonomyAxis | null {
    return null;
  }
}
