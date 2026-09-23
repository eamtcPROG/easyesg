import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { AccountProfileStore } from '../interfaces/account-profile-store.interface';
import type { AccountProfile } from '../models/account-profile.model';

/** UC-13's view (task 52.3; FR-9): the signed-in person's profile, across every organization they belong to. */
export class ReadAccountProfile {
  constructor(private readonly store: AccountProfileStore) {}

  async execute(query: { readonly accountId: string }): Promise<AccountProfile> {
    const profile = await this.store.find(query);
    // A session outliving its account: the same answer `ChangePassword` gives one, a 401 rather than a 404.
    if (profile === null) throw new AuthenticationRequiredError();
    return profile;
  }
}
