import type { LapsedAccountStore } from '../interfaces/lapsed-account-store.interface';

/**
 * The night's reclaiming of accounts past OQ-52's seven days (task 200; FR-3 AC-7): one unverified since registration,
 * or abandoned in setup past its deadline, deleted with everything that cascades from it.
 *
 * **Hygiene, not the rule.** An account past its window is already no account to every route — `accountHasLapsed` at
 * the point of use — so a late or missed night leaves nothing untrue; what this removes is an address and a password
 * hash whose purpose has expired (OQ-52). **It names no moment**: the function measures by the database's clock, so a
 * run retried hours later deletes what has lapsed since, which is past its window too (§12.5.6's task-200 row).
 */
export class ReclaimLapsedAccounts {
  constructor(private readonly store: LapsedAccountStore) {}

  execute(): Promise<number> {
    return this.store.reclaimLapsed();
  }
}
