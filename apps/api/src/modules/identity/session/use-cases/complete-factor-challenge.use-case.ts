import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  LOCKOUT_THRESHOLD,
  factorChallengeThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { SecondFactor } from '@api/modules/identity/account/interfaces/second-factor.interface';
import type { Clock } from '@api/contracts/clock.port';
import { factorChallengeHasExpired } from '../domain/factor-challenge';
import { FactorInvalidError } from '../errors/session.errors';
import type { FactorChallengeSealer } from '../interfaces/factor-challenge.interface';
import type { SessionStore } from '../interfaces/session-store.interface';
import type { IssuedSession } from '../models/session.model';
import type { SignIn } from './sign-in.use-case';

export interface CompleteFactorChallengeCommand {
  readonly challenge: string;
  readonly code: string;
  /** For §12.5.6's per-(IP, account) window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * UC-194 and UC-195 — the second step (NFR-95; task 27.3).
 *
 * **One refusal for every way this can fail**, and the list is longer than it looks: a wrong code,
 * a spent recovery code, an expired challenge, a challenge this api never sealed, a challenge for
 * an account whose factor has since been turned off, and a malformed value. All of them are
 * `FactorInvalidError`. The distinctions describe our verification to whoever is probing it, and
 * not one of them changes what the caller should do — which is the same argument NFR-64 makes for
 * sign-in's uniform credential failure, applied one step later.
 *
 * **It counts toward the same lockout the password step counts toward** (FR-4, UC-194). A factor
 * step with its own untracked budget would hand an attacker who has the password an unlimited
 * supply of guesses at six digits, which is 10^6 and falls in an afternoon. The counter is the
 * account's existing `failed_attempts`, not a second one, so ten failures across *both* steps lock
 * the account — and the throttle key is the one sign-in already uses, so both steps spend one
 * §12.5.6 window exactly as the admin realm's two steps do.
 *
 * **The session is minted by `SignIn.issue`**, not re-implemented here: the challenged and
 * unchallenged paths must issue the same thing, and AD-12's pair is assembled in one place.
 */
export class CompleteFactorChallenge {
  constructor(
    private readonly store: SessionStore,
    private readonly challenges: FactorChallengeSealer,
    private readonly secondFactor: SecondFactor,
    private readonly signIn: SignIn,
    private readonly now: Clock,
  ) {}

  async execute(command: CompleteFactorChallengeCommand): Promise<IssuedSession> {
    const now = this.now();

    // Opened before the throttle is touched, because the throttle key needs the account — and a
    // value that is not a challenge at all identifies nobody to throttle. Refusing it here costs
    // an attacker nothing they did not already have: forging one requires the sealing key.
    const challenge = this.challenges.open(command.challenge);
    if (challenge === null || factorChallengeHasExpired(challenge, now)) {
      throw new FactorInvalidError();
    }

    const key = factorChallengeThrottleKey(command.clientIp, challenge.accountId);
    const limited = await this.store.run(async (tx) => {
      const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
      const recent = await tx.countRecentAuthAttempts(key, since);
      await tx.recordAuthAttempt(key, now);
      return recent >= AUTH_ATTEMPT_LIMIT;
    });
    if (limited) throw new AuthRateLimitedError();

    // Every refusal below commits its counter before throwing — `SignIn`'s stated shape, and for
    // its stated reason: a throw inside `run` would roll back the very tally FR-4 rests on.
    if (!(await this.secondFactor.verify({ accountId: challenge.accountId, code: command.code }))) {
      await this.store.run((tx) =>
        tx.registerFailedSignIn(challenge.accountId, LOCKOUT_THRESHOLD, now),
      );
      throw new FactorInvalidError();
    }

    const account = await this.store.run((tx) => tx.findAccountById(challenge.accountId));
    // The account went away between the two steps. Not a user error to explain, and the same
    // refusal as a wrong code — a challenge naming nothing is a challenge that cannot be answered.
    if (account === null) throw new FactorInvalidError();

    await this.store.run((tx) => tx.clearFailedSignIns(account.id));
    return this.signIn.issue(account, now);
  }
}
