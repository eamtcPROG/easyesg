import type { CancelNotificationCommand, NotificationPort } from '@api/contracts/notification.port';
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
import { ValidationRulesUnavailableError } from '@api/modules/core/validation/errors/validation.errors';
import type {
  RuleSetInForce,
  ValidationRuleSets,
} from '@api/modules/core/validation/interfaces/validation-rule-sets.interface';

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
  const ORG = '00000000-0000-0000-0000-0000000000a1';

  /** The rule set a lock pins (task 41.1): revision 7 is in force, and the days it was asked about are kept. */
  const IN_FORCE: RuleSetInForce = { ruleSet: { rules: [] }, revision: 7 };

  const build = (rows = [aPeriod()], inForce: RuleSetInForce | null = IN_FORCE) => {
    const store = new FakeReportingPeriodStore(rows);
    const askedOn: string[] = [];
    const ruleSets: ValidationRuleSets = {
      inForce: ({ on }) => {
        askedOn.push(on);
        return inForce;
      },
      pinned: () => Promise.resolve(null),
    };
    let now = NOW;
    const cancelled: CancelNotificationCommand[] = [];
    const notifications: NotificationPort = {
      raise: () => Promise.reject(new Error('A lock raises nothing')),
      cancel: (command) => {
        cancelled.push(command);
        return Promise.resolve();
      },
    };
    return {
      store,
      askedOn,
      advance: () => {
        now = LATER;
      },
      at: (instant: Date) => {
        now = instant;
      },
      cancelled,
      useCase: new LockReportingPeriod(store, () => now, ruleSets, notifications, {
        repeatIntervalDays: () => 7,
        leadTimesDays: () => [14, 7, 1],
      }),
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
      const locked = await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });

      expect(locked.lockedAt).toEqual(NOW);
      expect(locked.lockedBy).toBe(ACTOR);
    });

    it('withdraws its report’s outstanding notice and every lead time’s deadline notice, on its own transaction (task 51.2)', async () => {
      const withReport = aPeriod({
        report: {
          id: '00000000-0000-0000-0000-0000000000d1',
          status: 'open',
          readyToFile: false,
          validation: null,
          updatedAt: NOW,
        },
      });
      const { useCase, cancelled } = build([withReport]);
      await useCase.lock({ periodId: withReport.id, actorId: ACTOR, organizationId: ORG });

      expect(cancelled).toEqual([
        {
          categoryKey: 'reporting.outstanding_report',
          organizationId: ORG,
          subjectRef: 'report:00000000-0000-0000-0000-0000000000d1:outstanding',
        },
        ...[14, 7, 1].map((lead) => ({
          categoryKey: 'reporting.report_deadline',
          organizationId: ORG,
          subjectRef: `period:${withReport.id}:deadline:${lead}`,
        })),
      ]);
    });

    it('withdraws only the deadline notices of a period with no report, and nothing when refused', async () => {
      const { useCase, cancelled } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });
      expect(cancelled.map((command) => command.categoryKey)).toEqual([
        'reporting.report_deadline',
        'reporting.report_deadline',
        'reporting.report_deadline',
      ]);

      await expect(useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG })).rejects.toThrow();
      expect(cancelled).toHaveLength(3);
    });

    it('refuses a period that is already locked, because the screen is stale', async () => {
      const { useCase } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });

      await expect(useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG })).rejects.toThrow(
        PeriodLockStateError,
      );
    });

    it('pins the validation rule set in force on the lock day, in the period’s own zone (FR-73 item 9)', async () => {
      const { useCase, askedOn, at } = build();
      // 22:30 UTC on 30 August is already the 31st in Chișinău, the period's zone.
      at(new Date('2026-08-30T22:30:00.000Z'));
      const locked = await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });

      expect(askedOn).toEqual(['2026-08-31']);
      expect(locked.lockedRuleSetRevision).toBe(7);
    });

    it('refuses the lock, and leaves the period open, where no rule set can be read', async () => {
      const { useCase, store } = build([aPeriod()], null);
      await expect(useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG })).rejects.toThrow(
        ValidationRulesUnavailableError,
      );
      expect((await store.findPeriod({ periodId: aPeriod().id }))?.lockedAt).toBeNull();
    });

    it('refuses a period that does not exist in the bound organization', async () => {
      const { useCase } = build();
      await expect(
        useCase.lock({ periodId: '00000000-0000-0000-0000-0000000000ff', actorId: ACTOR, organizationId: ORG }),
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
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });

      await expect(
        edit.update({
          periodId: aPeriod().id,
          patch: { dueDate: { date: '2027-04-30', timezone: 'Europe/Chisinau' } },
        }),
      ).rejects.toThrow(PeriodLockedError);
    });

    it('admits the same edit once the period is reopened', async () => {
      const { useCase, edit } = build();
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });
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
      await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });
      advance();

      const reopened = await useCase.reopen({
        periodId: aPeriod().id,
        reason: 'Cifra B3 corectată după verificarea facturilor',
        actorId: ACTOR,
      });
      expect(reopened.lockedAt).toBeNull();
      expect(reopened.lockedBy).toBeNull();
      // Open again, so it reads as at today rather than the set its lock pinned (FR-73 item 9).
      expect(reopened.lockedRuleSetRevision).toBeNull();

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
        await useCase.lock({ periodId: aPeriod().id, actorId: ACTOR, organizationId: ORG });
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
