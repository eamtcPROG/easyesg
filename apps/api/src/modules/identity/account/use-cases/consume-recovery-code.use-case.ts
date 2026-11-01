import type { Clock } from '@api/contracts/clock.port';
import { hashRecoveryCode } from '../domain/recovery-code';
import type { AccountStore } from '../interfaces/account-store.interface';
import { RECOVERY_CODE_OUTCOME } from '../models/totp.model';

export interface ConsumeRecoveryCodeCommand {
  readonly accountId: string;
  /** As the person typed it — grouped, lower-cased or with a letter O; `hashRecoveryCode` normalises. */
  readonly code: string;
}

/**
 * UC-195 — spend one recovery code, or refuse.
 *
 * **Separate from `ManageTotp` because its caller is, and will be, sign-in.** Task 27.3 folds the
 * challenge into task 21's `SignIn`, and that use case must reach one narrow operation rather than
 * a class carrying four password-gated management methods it has no business calling. This is
 * `ISP` applied at the point it actually costs something — and since task 133.1 it is a file of its
 * own as well as a class, which is `file-one-behaviour-api`'s reading of the same boundary.
 *
 * It answers a boolean and nothing more. The store distinguishes an unrecognised hash from one
 * already spent — a defender wants that difference, because the second means someone is replaying
 * a code that worked once — and the distinction stops here: NFR-64's uniform-response rule means
 * the caller must not be able to tell them apart.
 */
export class ConsumeRecoveryCode {
  constructor(
    private readonly store: AccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ConsumeRecoveryCodeCommand): Promise<boolean> {
    const codeHash = hashRecoveryCode(command.code);

    return this.store.run(async (tx) => {
      const outcome = await tx.spendRecoveryCode(
        { accountId: command.accountId, codeHash },
        this.now(),
      );
      return outcome === RECOVERY_CODE_OUTCOME.SPENT;
    });
  }
}
