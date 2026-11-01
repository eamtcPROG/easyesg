import type { Locale } from '@easyesg/i18n';
import { setupIsComplete } from '@api/modules/identity/account/domain/account-setup';
import { presentNamePart } from '@api/modules/identity/account/domain/display-name';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { Clock } from '@api/contracts/clock.port';
import { AccountSetupNotPendingError, SetupNamesRequiredError } from '../errors/account-setup.errors';
import type { AccountSetupStore } from '../interfaces/account-setup-store.interface';
import type { AccountSetupState } from '../models/account-setup.model';

export interface SaveSetupProfileCommand {
  readonly accountId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly locale: Locale;
}

/**
 * S-36's second step (task 155; §12.5.6's task-155 row (6), FR-9, FR-10): an account in setup saves
 * both name parts and its interface language, and is active once it also holds a password.
 *
 * **A setup-only call, and deliberately not a profile update.** It refuses an account that is not in
 * setup, because S-27's profile — a rename, a language change later — is task 52.3's surface with its
 * own rules, and a second route to the same columns would be the one nobody remembers when those
 * rules arrive.
 *
 * The names are trimmed and judged before the transaction opens: a part with no visible character is
 * not a name (`display-name.ts`), and refusing it first means nothing was saved, as the message says.
 */
export class SaveSetupProfile {
  constructor(
    private readonly store: AccountSetupStore,
    private readonly now: Clock,
  ) {}

  async execute(command: SaveSetupProfileCommand): Promise<AccountSetupState> {
    const givenName = presentNamePart(command.givenName);
    const familyName = presentNamePart(command.familyName);
    if (givenName === null || familyName === null) throw new SetupNamesRequiredError();

    return this.store.run(async (tx) => {
      const now = this.now();

      const state = await tx.findAccountForSetup(command.accountId);
      if (state === null) throw new AuthenticationRequiredError();
      if (state.account.status !== ACCOUNT_STATUS.AWAITING_SETUP) throw new AccountSetupNotPendingError();

      const saved = await tx.saveSetupProfile(
        { accountId: state.account.id, givenName, familyName, locale: command.locale },
        now,
      );

      const complete = setupIsComplete({ hasPassword: state.passwordSet, givenName, familyName });
      return {
        account: complete ? await tx.activateAccount(saved.id, now) : saved,
        passwordSet: state.passwordSet,
      };
    });
  }
}
