import type { Clock } from '@api/contracts/clock.port';
import { mintRecoveryCodes } from '@api/modules/identity/account/domain/recovery-code';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import type { AdminCredentialStore } from '../interfaces/admin-credential-store.interface';
import { reauthenticateOperator, type OperatorReauthentication } from './reauthenticate-operator';

export type IssueAdminRecoveryCodesCommand = OperatorReauthentication;

/**
 * UC-212 step three — ten recovery codes, the whole set replaced (task 144; §12.5.6's recovery-code row,
 * over the admin realm).
 *
 * **The only thing that mints them** (project owner, 14 Sep 2026): an account created by invitation or by
 * the CLI holds none until its operator comes here, and a re-enrolment leaves the set as it is. The first
 * issue and a re-issue are one operation, because replacing an empty set is issuing one.
 *
 * The values exist here and in the response only; the store keeps SHA-256 digests. `recovery-code.ts` is
 * the tenant realm's module, reused as a **mechanism** — the alphabet, the length, the normalisation —
 * and never as data, which is the line NFR-65 draws (`admin.module.ts`'s header).
 */
export class IssueAdminRecoveryCodes {
  constructor(
    private readonly store: AdminCredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: IssueAdminRecoveryCodesCommand): Promise<readonly string[]> {
    await reauthenticateOperator({
      store: this.store,
      hasher: this.hasher,
      now: this.now,
      command,
    });

    const minted = mintRecoveryCodes();
    await this.store.run((tx) =>
      tx.replaceRecoveryCodes({ accountId: command.accountId, hashes: minted.hashes, at: this.now() }),
    );
    return minted.values;
  }
}
