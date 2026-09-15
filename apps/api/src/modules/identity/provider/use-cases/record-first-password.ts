import { setupIsComplete } from '@api/modules/identity/account/domain/account-setup';
import { FirstPasswordAlreadySetError } from '../errors/account-setup.errors';
import type { AccountSetupTransaction } from '../interfaces/account-setup-store.interface';
import type { AccountSetupState } from '../models/account-setup.model';

/**
 * The first password's write, shared by S-36's step and the confirmation link's (task 155) — the
 * insert, and the activation it completes when the account already holds both name parts.
 *
 * **Shared because the two must not diverge**: a link path that forgot to activate would strand
 * exactly the account that gave its name before its password, holding everything setup asks for and
 * never active. It takes the caller's transaction, so the credential and the status commit with
 * whatever else the caller does — issuing a session, on the link path — or neither does.
 */
export async function recordFirstPassword(
  // A `Pick`, not the whole transaction (ISP): the write needs exactly these two operations.
  tx: Pick<AccountSetupTransaction, 'insertFirstPassword' | 'activateAccount'>,
  input: { readonly state: AccountSetupState; readonly passwordHash: string; readonly now: Date },
): Promise<AccountSetupState> {
  const { account } = input.state;

  const inserted = await tx.insertFirstPassword(
    { accountId: account.id, passwordHash: input.passwordHash },
    input.now,
  );
  // The primary key lost a race the caller's read could not see — a second submission got there first.
  if (!inserted) throw new FirstPasswordAlreadySetError();

  const complete = setupIsComplete({
    hasPassword: true,
    givenName: account.givenName,
    familyName: account.familyName,
  });

  return {
    account: complete ? await tx.activateAccount(account.id, input.now) : account,
    passwordSet: true,
  };
}
