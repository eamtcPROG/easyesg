import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { AccountSetupStore } from '../interfaces/account-setup-store.interface';
import type { AccountSetupState } from '../models/account-setup.model';

export interface ReadAccountSetupCommand {
  readonly accountId: string;
}

/**
 * S-36's read (task 155; §12.5.6's task-155 row): what the screen renders from — which step is owed,
 * the name part a provider seeded, the language to pre-select.
 *
 * **Open to any signed-in account, not only one in setup.** An active account reading it is told it
 * is complete, which is the answer a screen left open in a second tab after finishing needs; refusing
 * it would turn a finished setup into an error.
 */
export class ReadAccountSetup {
  constructor(private readonly store: AccountSetupStore) {}

  async execute(command: ReadAccountSetupCommand): Promise<AccountSetupState> {
    const state = await this.store.run((tx) => tx.findAccountForSetup(command.accountId));
    // `AuthGuard` resolved this account from a live session a moment ago, and a session cascades with
    // its account — so absent is a deletion racing this read, answered as the guard would answer it.
    if (state === null) throw new AuthenticationRequiredError();
    return state;
  }
}
