import { ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import {
  FakeReportingEntityStore,
  anEntity,
} from '@api/modules/core/entity/testing/entity.fakes';
import {
  EntityArchivedError,
  EntityNotFoundError,
} from '@api/modules/core/entity/errors/entity.errors';
import { OpenReportingPeriod } from './open-reporting-period.use-case';
import {
  FakeReportingPeriodStore,
  FakeTaxonomyRegistry,
  aPeriod,
} from '../testing/period.fakes';
import {
  PeriodDatesInvalidError,
  PeriodNotFoundError,
  TaxonomyVersionUnavailableError,
} from '../errors/period.errors';
import type { NewReportingPeriod } from '../models/reporting-period.model';

/**
 * UC-56 — open a reporting period (FR-21, FR-45, FR-66).
 *
 * No database, no container: the check `apps/api/CLAUDE.md` names for whether a use case is
 * framework-free. What is *not* here is deliberate — the overlap refusal, the prior-period linkage
 * and the entity snapshot are the store's, because each is a statement the database has to make
 * atomically and a fake asserting them would be asserting the fake. `test/periods.e2e-spec.ts`
 * carries those against real SQL.
 */
describe('OpenReportingPeriod (UC-56)', () => {
  const ENTITY_ID = '00000000-0000-0000-0000-0000000000b1';
  const NOW = new Date('2026-08-29T10:00:00.000Z');

  const aRequest = (over: Partial<NewReportingPeriod> = {}): NewReportingPeriod => ({
    reportingEntityId: ENTITY_ID,
    fiscalYear: 2026,
    periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
    periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
    dueDate: null,
    ...over,
  });

  const build = (options: { entity?: ReturnType<typeof anEntity>; registry?: FakeTaxonomyRegistry } = {}) => {
    const store = new FakeReportingPeriodStore();
    const entities = new FakeReportingEntityStore([options.entity ?? anEntity()]);
    const registry = options.registry ?? new FakeTaxonomyRegistry();
    return {
      store,
      registry,
      useCase: new OpenReportingPeriod(store, entities, registry, () => NOW),
    };
  };

  describe('the version pin (FR-66, DR-4)', () => {
    it('is taken from the registry and never from the request', async () => {
      const { useCase, store } = build();
      const period = await useCase.open({ period: aRequest() });

      expect(period.templateVersion).toBe('2026-05-01');
      expect(period.taxonomyVersion).toBe('2026-05-01');
      // The command type has no field for either, so the assertion that matters is that the store
      // was handed what the registry said rather than anything derived here.
      expect(store.opened[0]).toMatchObject({
        templateVersion: '2026-05-01',
        taxonomyVersion: '2026-05-01',
      });
    });

    /**
     * The rule with the least visible failure mode. A period backfilled for 2025 must pin what was
     * in force *then*; asking the registry about today would pin a 2025 filing to a taxonomy adopted
     * afterwards, and every assertion about the pin would still pass.
     */
    it('asks about the period’s own start date, not about today', async () => {
      const { useCase, registry } = build();
      await useCase.open({
        period: aRequest({
          fiscalYear: 2025,
          periodStart: { date: '2025-01-01', timezone: 'Europe/Chisinau' },
          periodEnd: { date: '2025-12-31', timezone: 'Europe/Chisinau' },
        }),
      });

      expect(registry.askedFor).toEqual(['2025-01-01']);
    });

    it('refuses to open a period when no version is registered', async () => {
      const { useCase } = build({ registry: new FakeTaxonomyRegistry(null) });
      await expect(useCase.open({ period: aRequest() })).rejects.toThrow(
        TaxonomyVersionUnavailableError,
      );
    });
  });

  describe('the entity', () => {
    it('refuses an entity that does not exist in the bound organization', async () => {
      const { useCase } = build();
      await expect(
        useCase.open({ period: aRequest({ reportingEntityId: '00000000-0000-0000-0000-0000000000ff' }) }),
      ).rejects.toThrow(EntityNotFoundError);
    });

    /** FR-20: an archived entity keeps its history and takes no new work. */
    it('refuses an archived entity', async () => {
      const { useCase } = build({
        entity: anEntity({ status: ENTITY_STATUS.ARCHIVED, archivedAt: NOW }),
      });
      await expect(useCase.open({ period: aRequest() })).rejects.toThrow(EntityArchivedError);
    });
  });

  describe('the dates (NFR-34)', () => {
    it('accepts a period whose boundaries are real days in a real zone', async () => {
      const { useCase } = build();
      const period = await useCase.open({ period: aRequest() });
      expect(period.periodStart).toEqual({ date: '2026-01-01', timezone: 'Europe/Chisinau' });
      expect(period.periodEnd).toEqual({ date: '2026-12-31', timezone: 'Europe/Chisinau' });
    });

    it('refuses an end before the start', async () => {
      const { useCase } = build();
      await expect(
        useCase.open({
          period: aRequest({ periodEnd: { date: '2025-12-31', timezone: 'Europe/Chisinau' } }),
        }),
      ).rejects.toThrow(PeriodDatesInvalidError);
    });

    /**
     * The case a regex alone admits: `2026-02-30` has the right shape and `Date` rolls it forward to
     * 2 March, so without the round-trip a boundary nobody typed would be stored — and a fiscal year
     * settled by a silent correction.
     */
    it('refuses a date that is not a real calendar day', async () => {
      const { useCase } = build();
      await expect(
        useCase.open({
          period: aRequest({ periodEnd: { date: '2026-02-30', timezone: 'Europe/Chisinau' } }),
        }),
      ).rejects.toThrow(PeriodDatesInvalidError);
    });

    it('refuses a zone the tz database does not carry', async () => {
      const { useCase } = build();
      await expect(
        useCase.open({
          period: aRequest({ periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinaw' } }),
        }),
      ).rejects.toThrow(PeriodDatesInvalidError);
    });

    it('refuses a due date that is not a real day, and admits one that is', async () => {
      const { useCase } = build();
      await expect(
        useCase.open({
          period: aRequest({ dueDate: { date: '2027-13-01', timezone: 'Europe/Chisinau' } }),
        }),
      ).rejects.toThrow(PeriodDatesInvalidError);

      const period = await useCase.open({
        period: aRequest({ dueDate: { date: '2027-03-31', timezone: 'Europe/Chisinau' } }),
      });
      expect(period.dueDate).toEqual({ date: '2027-03-31', timezone: 'Europe/Chisinau' });
    });

    /**
     * A due date **before** the period end is admitted on purpose. FR-21 draws a conceptual
     * distinction — the date the report must be complete is not the date the period ends — and not
     * an ordering; an undertaking with an internal deadline ahead of its own year end is doing
     * something sensible that a `>` check would refuse.
     */
    it('admits a due date before the period end, which FR-21 does not forbid', async () => {
      const { useCase } = build();
      const period = await useCase.open({
        period: aRequest({ dueDate: { date: '2026-12-15', timezone: 'Europe/Chisinau' } }),
      });
      expect(period.dueDate?.date).toBe('2026-12-15');
    });
  });

  describe('editing the shell', () => {
    /**
     * The patch is partial, so the dates are checked against the row as it *will* stand. Moving only
     * the end date past the start is otherwise unrepresentable as a failure here and would surface
     * as a constraint violation with no message a screen could use.
     */
    it('validates a partial patch against the stored row, not against what arrived', async () => {
      const store = new FakeReportingPeriodStore([aPeriod()]);
      const useCase = new OpenReportingPeriod(
        store,
        new FakeReportingEntityStore(),
        new FakeTaxonomyRegistry(),
        () => NOW,
      );

      await expect(
        useCase.update({
          periodId: aPeriod().id,
          patch: { periodEnd: { date: '2025-06-30', timezone: 'Europe/Chisinau' } },
        }),
      ).rejects.toThrow(PeriodDatesInvalidError);
    });

    it('refuses a period that does not exist in the bound organization', async () => {
      const { useCase } = build();
      await expect(
        useCase.update({ periodId: '00000000-0000-0000-0000-0000000000ff', patch: { fiscalYear: 2027 } }),
      ).rejects.toThrow(PeriodNotFoundError);
    });

    it('applies a patch that leaves the dates describing a period', async () => {
      const store = new FakeReportingPeriodStore([aPeriod()]);
      const useCase = new OpenReportingPeriod(
        store,
        new FakeReportingEntityStore(),
        new FakeTaxonomyRegistry(),
        () => NOW,
      );

      const updated = await useCase.update({
        periodId: aPeriod().id,
        patch: { dueDate: { date: '2027-04-30', timezone: 'Europe/Chisinau' } },
      });
      expect(updated.dueDate?.date).toBe('2027-04-30');
      // The pin is untouched by an edit — DR-4 moves it only by an explicit migration (FR-69), and
      // the patch type has no field that could.
      expect(updated.taxonomyVersion).toBe('2026-05-01');
    });
  });
});
