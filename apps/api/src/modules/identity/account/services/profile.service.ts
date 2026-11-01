import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { AccountProfile } from '../models/account-profile.model';
import { ReadAccountProfile } from '../use-cases/read-account-profile.use-case';
import { SaveAccountProfile, type SaveAccountProfileCommand } from '../use-cases/save-account-profile.use-case';

/**
 * The seam between `ProfileController` and its two use cases (task 52.3), and where the one ambient value is resolved:
 * **the account, from the session** — never from the wire, so no caller reads or writes another person's profile.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly readProfile: ReadAccountProfile,
    private readonly saveProfile: SaveAccountProfile,
  ) {}

  read(): Promise<AccountProfile> {
    return this.readProfile.execute({ accountId: sessionAccount() });
  }

  save(input: Omit<SaveAccountProfileCommand, 'accountId'>): Promise<AccountProfile> {
    return this.saveProfile.execute({ ...input, accountId: sessionAccount() });
  }
}

/** `PasswordService`'s reading: reaching here without an actor is a guard regression, answered 401 rather than a throw. */
const sessionAccount = (): string => {
  const actorId = requestContext()?.actorId;
  if (actorId === undefined) throw new AuthenticationRequiredError();
  return actorId;
};
