import {
  LOCKOUT_THRESHOLD,
  admitAuthAttempt,
  factorChallengeThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { SecondFactor } from '@api/modules/identity/account/interfaces/second-factor.interface';
import type { Clock } from '@api/contracts/clock.port';
import { factorChallengeHasExpired } from '../domain/factor-challenge';
import { AccountLockedError, FactorInvalidError } from '../errors/session.errors';
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
 * **It both feeds and honours the lockout FR-4 counts** (UC-194). A factor step with its own
 * untracked budget would hand an attacker who has the password an unlimited supply of guesses at
 * six digits, which is 10^6 and falls in an afternoon. The counter is the account's existing
 * `failed_attempts` rather than a second one, and — corrected 27 Aug 2026 — the lock it reaches is
 * **checked here as well as written here**. Until then this use case incremented a control it never
 * read: `AccountLockedError` was unreachable on this route, a challenge issued moments before a
 * lock still minted a session, and S-01's lockout state was dead code on the screen. Written and
 * not read is the one shape a security control must never have.
 *
 * The check sits **before** the code is verified, which is `SignIn`'s ordering and its reason: a
 * locked credential is not verified at all, so the lock also ends the oracle.
 *
 * **What bounds guessing here is the throttle, not the lockout**, and the earlier comment had that
 * backwards. The password success that produces a challenge clears `failed_attempts`, so this step
 * begins at zero, and the window admits five attempts against a challenge that lives five minutes —
 * so ten consecutive failures is not a state this step can reach by itself. It contributes to the
 * tally and it refuses once the tally is spent, which is a real property; the *budget* is
 * §12.5.6's five per fifteen minutes, and that is what makes 10^6 unwalkable.
 *
 * **The throttle key is this step's own** (`factor-challenge`, keyed on the account), NOT sign-in's
 * — see `auth-throttle.ts`, which states why the two steps of one sign-in keep separate budgets. An
 * earlier version of this paragraph claimed the opposite; the two comments disagreed on the
 * question a reader consults them to answer, which is how many guesses an attacker actually gets.
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

    // The window and the lock in one transaction: both are reads-or-writes about this account and
    // neither depends on the other's answer, so a second `run` would check out a second pooled
    // connection to learn something the first already had in hand.
    const key = factorChallengeThrottleKey(command.clientIp, challenge.accountId);
    const gate = await this.store.run(async (tx) => ({
      admitted: await admitAuthAttempt(tx, { key, now }),
      credential: await tx.findCredential(challenge.accountId),
    }));
    if (!gate.admitted) throw new AuthRateLimitedError();

    // FR-4's lock, honoured. Distinct from `FactorInvalidError` for the reason `session.errors.ts`
    // gives: reaching this state requires having driven a real credential to ten consecutive
    // failures, so naming it discloses nothing to anyone who has not already done that — and the
    // caller needs the difference, because the way out is a reset link and not another code.
    if (gate.credential?.lockedAt) throw new AccountLockedError();

    // Every refusal below commits its counter before throwing — `SignIn`'s stated shape, and for
    // its stated reason: a throw inside `run` would roll back the very tally FR-4 rests on.
    if (!(await this.secondFactor.verify({ accountId: challenge.accountId, code: command.code }))) {
      await this.store.run((tx) =>
        tx.registerFailedSignIn(challenge.accountId, LOCKOUT_THRESHOLD, now),
      );
      throw new FactorInvalidError();
    }

    // Read and clear together — one transaction, because both sit after every throw site above and
    // nothing here can roll a counter back.
    const account = await this.store.run(async (tx) => {
      const found = await tx.findAccountById(challenge.accountId);
      if (found !== null) await tx.clearFailedSignIns(found.id);
      return found;
    });
    // The account went away between the two steps. Not a user error to explain, and the same
    // refusal as a wrong code — a challenge naming nothing is a challenge that cannot be answered.
    if (account === null) throw new FactorInvalidError();

    // The answer given at the password step, carried by the sealed challenge — never re-asked.
    return this.signIn.issue({ account, now, remembered: challenge.remembered });
  }
}
