import { OpenReportingPeriod } from './open-reporting-period.use-case';
import { LockReportingPeriod } from './lock-reporting-period.use-case';
import { FakeReportingEntityStore } from '@api/modules/core/entity/testing/entity.fakes';
import {
  FakeReportingPeriodStore,
  FakeTaxonomyRegistry,
  aPeriod,
} from '../testing/period.fakes';
import {
  PeriodLockStateError,
  PeriodLockedError,
  PeriodNotFoundError,
} from '../errors/period.errors';

/**
 * UC-57 and UC-58 — lock and reopen (FR-22).
 *
 * What is here is the state machine: a period may be locked only when open, reopened only when
 * locked, and takes no edit while locked. What is **not** here is the database's half — the trigger
 * that refuses a write to a locked row whatever the application believes, and the record that
 * commits with the unlock or not at all. `test/periods.e2e-spec.ts` carries those, because a fake
 * asserting them would be asserting the fake.
 */
describe('LockReportingPeriod (UC-57, UC-58)', () => {
  const NOW = new Date('2026-08-30T09:00:00.000Z');
  const LATER = new Date('2026-08-30T10:00:00.000Z');
  const ACTOR = '00000000-0000-0000-0000-0000000000f1';

  const build = (rows = [aPeriod()]) => {
    const store = new FakeReportingPeriodStore(rows);
    let now = NOW;
    return {
      store,
      advance: () => {
        now = LATER;
      },
      useCase: new LockReportingPeriod(store, () => now),
      edit: new OpenReportingPeriod(
        store,
        new FakeReportingEntityStore(),
        new FakeTaxonomyRegistry(),
        () => now,
      ),
    };
  };

  describe('locking (UC-57)', () => {
    it('records when and by whom', async () => {
      const { useCase } = build();
      const locked = await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });

      expect(locked.lockedAt).toEqual(NOW);
      expect(locked.lockedBy).toBe(ACTOR);
    });

    it('refuses a period that is already locked, because the screen is stale', async () => {
      const { useCase } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });

      await expect(useCase.lock({ periodId: aPeriod().id, actorId: ACTOR })).rejects.toThrow(
        PeriodLockStateError,
      );
    });

    it('refuses a period that does not exist in the bound organization', async () => {
      const { useCase } = build();
      await expect(
        useCase.lock({ periodId: '00000000-0000-0000-0000-0000000000ff', actorId: ACTOR }),
      ).rejects.toThrow(PeriodNotFoundError);
    });
  });

  /**
   * §12.5.6's task-31.2 row, stated as a test: the lock is **not a role gate**. UC-57 names the
   * Reporting Contributor and this use case never sees a role at all — there is no branch it could
   * take on one, which is what makes the property structural rather than remembered.
   */
  describe('a locked period takes no writes', () => {
    it('refuses an edit to the shell, the administrator’s included', async () => {
      const { useCase, edit } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });

      await expect(
        edit.update({
          periodId: aPeriod().id,
          patch: { dueDate: { date: '2027-04-30', timezone: 'Europe/Chisinau' } },
        }),
      ).rejects.toThrow(PeriodLockedError);
    });

    it('admits the same edit once the period is reopened', async () => {
      const { useCase, edit } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });
      await useCase.reopen({ periodId: aPeriod().id, reason: 'corectare', actorId: ACTOR });

      const updated = await edit.update({
        periodId: aPeriod().id,
        patch: { dueDate: { date: '2027-04-30', timezone: 'Europe/Chisinau' } },
      });
      expect(updated.dueDate?.date).toBe('2027-04-30');
    });
  });

  describe('reopening (UC-58)', () => {
    it('clears the lock and records who, when and why', async () => {
      const { useCase, advance } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });
      advance();

      const reopened = await useCase.reopen({
        periodId: aPeriod().id,
        reason: 'Cifra B3 corectată după verificarea facturilor',
        actorId: ACTOR,
      });
      expect(reopened.lockedAt).toBeNull();
      expect(reopened.lockedBy).toBeNull();

      const [record] = await useCase.reopenings({ periodId: aPeriod().id });
      expect(record).toMatchObject({
        // The lock this reopening ended, so the record states the whole amendment rather than half.
        lockedAt: NOW,
        reopenedAt: LATER,
        reopenedBy: ACTOR,
        reason: 'Cifra B3 corectată după verificarea facturilor',
      });
    });

    it('refuses a period that is not locked', async () => {
      const { useCase } = build();
      await expect(
        useCase.reopen({ periodId: aPeriod().id, reason: 'corectare', actorId: ACTOR }),
      ).rejects.toThrow(PeriodLockStateError);
    });

    /** UX-72: an amendment must look like an amendment, and a second one must not hide the first. */
    it('keeps every reopening, most recent first', async () => {
      const { useCase } = build();
      for (const reason of ['prima corectare', 'a doua corectare']) {
        await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR });
        await useCase.reopen({ periodId: aPeriod().id, reason, actorId: ACTOR });
      }

      const records = await useCase.reopenings({ periodId: aPeriod().id });
      expect(records.map((record) => record.reason)).toEqual([
        'a doua corectare',
        'prima corectare',
      ]);
    });
  });
});
