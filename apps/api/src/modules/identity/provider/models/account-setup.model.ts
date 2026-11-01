import type { Locale } from '@easyesg/i18n';
import type { Account } from '@api/modules/identity/account/models/account.model';

/**
 * An account as its setup sees it (task 155; S-36): the account, and whether it holds a password —
 * the one fact every setup decision needs that lives in another table.
 */
export interface AccountSetupState {
  readonly account: Account;
  readonly passwordSet: boolean;
}

/** What S-36's second step saves — both name parts, already trimmed, and the interface language. */
export interface SetupProfile {
  readonly accountId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly locale: Locale;
}
