import type { Clock } from '@api/contracts/clock.port';
import {
  adminReauthenticationThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminReauthenticationFailedError } from '../errors/admin-credentials.errors';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import type {
  AdminCredentialStore,
  AdminOperatorCredential,
} from '../interfaces/admin-credential-store.interface';

/** Who is re-authenticating, with what, and from where. */
export interface OperatorReauthentication {
  readonly accountId: string;
  readonly password: string;
  /** For the realm's re-authentication window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * A-19's one rule, written once (task 144): **every write re-authenticates**, the confirmation of a
 * re-enrolment included. `ManageTotp.reauthenticate`'s shape over the admin realm — shared as a function
 * because four use cases apply it and none of them owns it.
 *
 * **Two short units of work and the hash between them**, for that method's three reasons: a refusal must
 * durably spend an attempt, Argon2id must not hold a pooled connection, and a nested `run` would hold two.
 * The window is admitted **before** the password is verified, so every guess costs one, and it does not
 * feed FR-4's lockout — the caller already holds a session, and a mistype must not sign them out of it.
 *
 * **An account that is no longer active answers as a session that ended.** `AdminRealmGuard` admitted the
 * request moments ago, so this is a suspension or a removal racing it, and the console's answer to that is
 * to sign in — which the account can no longer do.
 */
export async function reauthenticateOperator(input: {
  readonly store: AdminCredentialStore;
  readonly hasher: PasswordHasher;
  readonly now: Clock;
  readonly command: OperatorReauthentication;
}): Promise<AdminOperatorCredential> {
  const { command, store } = input;

  const key = adminReauthenticationThrottleKey(command.clientIp, command.accountId);
  const admitted = await store.run((tx) => admitAuthAttempt(tx, { key, now: input.now() }));
  if (!admitted) throw new AuthRateLimitedError();

  const credential = await store.run((tx) => tx.findCredential(command.accountId));
  if (credential === null) throw new AdminSessionInvalidError();

  // One object, not two strings: `verify(hash, password)` would compile with the arguments swapped.
  const matches = await input.hasher.verify({
    digest: credential.passwordHash,
    password: command.password,
  });
  if (!matches) throw new AdminReauthenticationFailedError();

  return credential;
}
