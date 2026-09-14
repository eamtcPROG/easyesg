import type { AdminCredentialStore } from '../interfaces/admin-credential-store.interface';
import type { AdminCredentialState } from '../models/admin-credentials.model';

export interface ReadAdminCredentialsCommand {
  readonly accountId: string;
}

/**
 * What A-19 reads (task 144; UC-212) — when the recovery codes were issued and how many remain. Never a
 * code, never a secret, and nothing about the password or the factor in force, which every operator holds
 * by invariant.
 */
export class ReadAdminCredentials {
  constructor(private readonly store: AdminCredentialStore) {}

  execute(command: ReadAdminCredentialsCommand): Promise<AdminCredentialState> {
    return this.store.run((tx) => tx.readCredentialState(command.accountId));
  }
}
