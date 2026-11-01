import type { AuthAttemptRecorder } from '@api/modules/identity/account/domain/auth-throttle';
import type { AdminCredentialState } from '../models/admin-credentials.model';
import type { AdminSessionRevokedReason } from '../models/admin-session.model';

/** What re-authentication needs of an operator: the address their factor is labelled with, and the hash to verify. */
export interface AdminOperatorCredential {
  readonly email: string;
  readonly passwordHash: string;
}

/**
 * A-19's store (task 144; UC-212) — an operator's own password, staged second factor and recovery codes,
 * over the realm's tables.
 *
 * **A port of its own rather than more methods on a sibling.** `AdminSessionStore` is sign-in and rotation,
 * which have no business replacing a password; `AdminAccountStore` is A-08, and deliberately opens no
 * secret — which this one must, to put a staged factor in force. ISP at the point it costs something.
 *
 * **The usage rule is sign-in's**: the re-authentication window is spent in its own unit of work before a
 * password is verified, so a refusal durably costs an attempt while the request answers 403.
 */
export interface AdminCredentialTransaction extends AuthAttemptRecorder {
  /** The operator's address and password hash while the account is active; null once it is not. */
  findCredential(accountId: string): Promise<AdminOperatorCredential | null>;

  replacePassword(input: {
    readonly accountId: string;
    readonly passwordHash: string;
    readonly at: Date;
  }): Promise<void>;

  /** Ends the account's live sessions but one, answering how many ended. */
  revokeOtherSessions(input: {
    readonly accountId: string;
    readonly exceptSessionId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<number>;

  /** Stages a secret beside the factor in force, replacing any staged before it; false once the account is not active. */
  stageTotpSecret(input: {
    readonly accountId: string;
    readonly secret: string;
    readonly at: Date;
  }): Promise<boolean>;

  /**
   * The staged secret, **locking the account row until the unit of work ends** — so a `begin` landing
   * between a code's check and the promotion cannot put in force a secret the code never proved.
   */
  findStagedTotpSecretForUpdate(accountId: string): Promise<string | null>;

  /** The staged secret becomes the factor in force, and the staging clears, in one statement. */
  promoteStagedTotpSecret(input: { readonly accountId: string; readonly at: Date }): Promise<void>;

  /** Replaces the whole set — the old codes gone, the new digests written — so a set half spent leaves nothing live. */
  replaceRecoveryCodes(input: {
    readonly accountId: string;
    readonly hashes: readonly Buffer[];
    readonly at: Date;
  }): Promise<void>;

  readCredentialState(accountId: string): Promise<AdminCredentialState>;
}

export interface AdminCredentialStore {
  run<T>(work: (tx: AdminCredentialTransaction) => Promise<T>): Promise<T>;
}

export const ADMIN_CREDENTIAL_STORE = Symbol('ADMIN_CREDENTIAL_STORE');
