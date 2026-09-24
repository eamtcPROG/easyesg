import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordState } from '../models/account.model';

/**
 * S-28's password row (task 169; `design_spec.md` OQ-19, closed 24 Sep 2026): whether the signed-in account holds a
 * password, and when it last changed. Never the hash — `findPasswordState` does not read it.
 *
 * A provider-only account (FR-2) answers `set: false`, which is a state of the screen rather than a refusal: its row
 * offers a first password instead of a change.
 */
export class ReadPasswordState {
  constructor(private readonly store: AccountStore) {}

  execute(query: { readonly accountId: string }): Promise<PasswordState> {
    return this.store.run((tx) => tx.findPasswordState(query.accountId));
  }
}
