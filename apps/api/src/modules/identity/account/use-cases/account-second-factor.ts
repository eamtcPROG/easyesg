import { verifyTotp } from '@api/modules/platform/admin/domain/totp';
import type { Clock } from '@api/contracts/clock.port';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { SecondFactor } from '../interfaces/second-factor.interface';
import { ConsumeRecoveryCode } from './manage-totp.use-case';

/**
 * `SecondFactor` over this module's own store (task 27.3).
 *
 * **The order of the two attempts is the only decision in the file, and it is deliberate.** A TOTP
 * code is checked first because it is the overwhelmingly common answer and costs one HMAC; a
 * recovery code is tried only when that fails, and trying it *spends* the code. Reversing the
 * order would spend a recovery code every time someone typed a valid TOTP code that happened to
 * normalise into a stored hash — which cannot happen, since six digits are not sixteen characters,
 * but the ordering states the intent rather than relying on the formats staying disjoint forever.
 *
 * An account with no confirmed enrolment answers `false` to everything here rather than throwing.
 * Reaching `verify` for such an account means a challenge was presented for a factor that does not
 * exist, which is not a user error to explain — it is a stale or forged challenge, and the caller
 * turns it into the same refusal as a wrong code.
 */
export class AccountSecondFactor implements SecondFactor {
  constructor(
    private readonly store: AccountStore,
    private readonly consumeRecoveryCode: ConsumeRecoveryCode,
    private readonly now: Clock,
  ) {}

  async isEnrolled(accountId: string): Promise<boolean> {
    const enrolment = await this.store.run((tx) => tx.findTotpEnrolment(accountId));
    return enrolment !== null && enrolment.confirmedAt !== null;
  }

  async verify(answer: { readonly accountId: string; readonly code: string }): Promise<boolean> {
    const enrolment = await this.store.run((tx) => tx.findTotpEnrolment(answer.accountId));
    if (enrolment === null || enrolment.confirmedAt === null) return false;

    if (verifyTotp({ secret: enrolment.secret, code: answer.code }, this.now())) return true;

    return this.consumeRecoveryCode.execute({
      accountId: answer.accountId,
      code: answer.code,
    });
  }
}
