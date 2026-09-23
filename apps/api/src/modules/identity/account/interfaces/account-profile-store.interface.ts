import type { AccountProfile, AccountProfileChange } from '../models/account-profile.model';

/**
 * S-27's profile over `identity.account` (task 52.3). **Keyed by the account alone**, which is always the session's:
 * a profile follows the person across organizations (FR-9), so there is no tenant to bind, as for every `/account/*`
 * store.
 */
export interface AccountProfileStore {
  /** `null` for an account that no longer exists — a session outliving its account, which the caller refuses. */
  find(query: { readonly accountId: string }): Promise<AccountProfile | null>;
  /** Writes every field of the change and answers the profile as it now stands; `null` as `find`. */
  save(command: { readonly accountId: string; readonly change: AccountProfileChange }): Promise<AccountProfile | null>;
}

export const ACCOUNT_PROFILE_STORE = Symbol('ACCOUNT_PROFILE_STORE');
