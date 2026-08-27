import { mintTotpSecret, totpEnrolmentUri, verifyTotp } from '@api/modules/platform/admin/domain/totp';
import type { Clock } from '@api/contracts/clock.port';
import {
  admitAuthAttempt,
  reauthenticationThrottleKey,
  totpConfirmationThrottleKey,
} from '../domain/auth-throttle';
import { AuthRateLimitedError } from '../errors/account.errors';
import {
  hashRecoveryCode,
  mintRecoveryCodes,
} from '../domain/recovery-code';
import {
  ReauthenticationFailedError,
  TotpAlreadyEnrolledError,
  TotpCodeInvalidError,
  TotpNotEnrolledError,
} from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import { RECOVERY_CODE_OUTCOME, type TotpState } from '../models/totp.model';

/**
 * UC-193 — enrol, confirm, disenrol and re-issue the opt-in second factor (NFR-95; task 27.2).
 *
 * **Four operations in one file because they share one invariant**, not for convenience: every one
 * of them re-authenticates first, and writing that rule once is what keeps it from being the
 * operation someone forgets. §12.5.6's task-27.2 row states it — a second factor is the control
 * that survives a compromised session, so a compromised session must not install or strip one,
 * which is FR-8's rule for linking a provider applied to the same screen for the same reason.
 *
 * **The TOTP primitive is borrowed from `platform/admin/domain/totp.ts`, and that is not the
 * boundary breach it looks like.** `admin.module.ts` already records the distinction this rests
 * on: NFR-65's separation is about **data** — separate tables, cookie, secret — and what may be
 * shared is auth *mechanisms*. RFC 6238 over a base32 secret is a mechanism; a second copy of it
 * would be two implementations of one algorithm, drifting on the window, the digits or the step,
 * which is exactly the class of defect the 24 Aug 2026 review found in the hand-rolled original.
 * What this module must never borrow is the admin realm's tables or its `AdminSessionStore`, and
 * it borrows neither.
 *
 * **Two steps, and activation belongs to the second.** `begin` issues a secret and stores it
 * unconfirmed; `confirm` requires a current code, which is the only evidence that the
 * authenticator actually captured the secret. Activating on issue would hand a locked-out account
 * to every user whose scan silently failed — they would hold a factor no device can answer, and
 * the recovery codes that fix it are not issued until confirmation either.
 */

/** Ambient fields the service resolves, listed by the `Omit` on each service method. */
interface ActorCommand {
  readonly accountId: string;
  /** Absent for a provider-only account — see `reauthenticate`. */
  readonly password?: string;
  /** For §12.5.6's re-authentication window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

export type BeginTotpEnrolmentCommand = ActorCommand;
export type DisableTotpCommand = ActorCommand;
export type ReissueRecoveryCodesCommand = ActorCommand;

export interface ConfirmTotpEnrolmentCommand {
  readonly accountId: string;
  readonly code: string;
  /** For §12.5.6's confirmation window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/** What the authenticator needs, and the only time the secret leaves the server. */
export interface TotpEnrolmentOffer {
  readonly secret: string;
  /** Key Uri Format, emitted by the same object that verifies, so the two cannot disagree. */
  readonly enrolmentUri: string;
}

export class ManageTotp {
  constructor(
    private readonly store: AccountStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  /**
   * §12.5.6's re-authentication rule, in one place — and it runs **outside** the caller's
   * transaction, which is the shape rather than an accident.
   *
   * Three reasons, and `SignIn` states all of them for its own path. A refusal must durably cost
   * the caller an attempt, and a throw inside the work's transaction would roll back the very row
   * the window rests on. Argon2id is tens of milliseconds by design (§9.1) and a pooled connection
   * must not idle through it. And a nested `run` would hold two connections against one request
   * for no reason at all.
   *
   * A provider-only account (FR-2) has no credential row, and there the session stands as the
   * credential — the recorded assumption, taken because requiring a fresh OIDC assertion would
   * pull task 24's redirect flow into a settings screen. It is checked by the ABSENCE of a
   * credential rather than by a flag on the request, so an account that has a password cannot skip
   * the step by omitting the field.
   *
   * **Throttled since task 27.5**, which is a correction rather than an addition: these three
   * routes shipped on 26 Aug 2026 as password oracles reachable with only a stolen session, bounded
   * by nothing but the edge's 300 req/min. §12.5.6's re-authentication row names the path, and
   * `ChangePassword` spends the same key — a settings screen has one budget, not one per control.
   */
  private async reauthenticate(command: ActorCommand): Promise<void> {
    const credential = await this.store.run((tx) => tx.findCredential(command.accountId));
    if (credential === null) return;

    const key = reauthenticationThrottleKey(command.clientIp, command.accountId);
    const admitted = await this.store.run((tx) =>
      admitAuthAttempt(tx, { key, now: this.now() }),
    );
    if (!admitted) throw new AuthRateLimitedError();

    if (command.password === undefined) throw new ReauthenticationFailedError();
    // One object, not two strings: `verify(hash, password)` compiles perfectly with the
    // arguments swapped and answers a plausible `false` (CLAUDE.md's rule, and the port's shape).
    if (
      !(await this.hasher.verify({
        digest: credential.passwordHash,
        password: command.password,
      }))
    ) {
      throw new ReauthenticationFailedError();
    }
  }

  /** Step one: a secret the authenticator can capture, stored inert until step two. */
  async begin(command: BeginTotpEnrolmentCommand): Promise<TotpEnrolmentOffer> {
    const secret = mintTotpSecret();

    await this.reauthenticate(command);

    return this.store.run(async (tx) => {
      const account = await tx.findAccountById(command.accountId);
      // The account is the caller's own — AuthGuard resolved it — so absence here is a deleted
      // account racing its own session, not an input to validate.
      if (account === null) throw new TotpNotEnrolledError();

      if (!(await tx.beginTotpEnrolment({ accountId: command.accountId, secret }, this.now()))) {
        throw new TotpAlreadyEnrolledError();
      }

      return { secret, enrolmentUri: totpEnrolmentUri(account.email, secret) };
    });
  }

  /**
   * Step two: the code proves capture, the factor activates, and the recovery codes are issued.
   *
   * No re-authentication here, and that is deliberate rather than an omission: `begin` already
   * took the password moments ago, and this step's own evidence — a current code from the secret
   * just issued — is stronger than a password for the thing being proved. Asking twice would make
   * the enrolment screen ask for a password between two fields of one form.
   *
   * **It is throttled all the same, since 27 Aug 2026**, and "no password here" was exactly the
   * reasoning that left it unbounded: task 27.5 threw a window at the three routes that *take* a
   * password and passed over the one that takes a code. The asymmetry is backwards — a password is
   * a secret the caller either knows or does not, while six digits is a space of 10^6 that an
   * unbounded caller walks, and this is the route that answers a hit with ten recovery codes.
   * `totpConfirmationThrottleKey`'s note carries the reachable case.
   *
   * The window is spent **outside** the work's transaction, for `reauthenticate`'s first reason: a
   * refusal must durably cost the caller an attempt, and a throw inside `run` would roll back the
   * row the window rests on.
   */
  async confirm(command: ConfirmTotpEnrolmentCommand): Promise<readonly string[]> {
    const minted = mintRecoveryCodes();

    const key = totpConfirmationThrottleKey(command.clientIp, command.accountId);
    const admitted = await this.store.run((tx) =>
      admitAuthAttempt(tx, { key, now: this.now() }),
    );
    if (!admitted) throw new AuthRateLimitedError();

    return this.store.run(async (tx) => {
      const enrolment = await tx.findTotpEnrolment(command.accountId);
      if (enrolment === null) throw new TotpNotEnrolledError();
      if (enrolment.confirmedAt !== null) throw new TotpAlreadyEnrolledError();

      if (!verifyTotp({ secret: enrolment.secret, code: command.code }, this.now())) {
        throw new TotpCodeInvalidError();
      }

      // Conditional, so two requests carrying the same first code activate exactly once — and the
      // loser issues no second set of recovery codes, which is what the ordering here protects.
      if (!(await tx.confirmTotpEnrolment(command.accountId, this.now()))) {
        throw new TotpAlreadyEnrolledError();
      }
      await tx.replaceRecoveryCodes(command.accountId, minted.hashes);

      return minted.values;
    });
  }

  /** UC-193 in reverse. Opt-in that cannot be reversed is not opt-in (NFR-95). */
  async disable(command: DisableTotpCommand): Promise<void> {
    await this.reauthenticate(command);

    await this.store.run(async (tx) => {
      const enrolment = await tx.findTotpEnrolment(command.accountId);
      if (enrolment === null) throw new TotpNotEnrolledError();

      // Codes first, then the enrolment: the reverse order would leave a window where a factor is
      // gone and its recovery codes are live, and a recovery code is a credential.
      await tx.replaceRecoveryCodes(command.accountId, []);
      await tx.deleteTotpEnrolment(command.accountId);
    });
  }

  /** §12.5.6: re-issuing replaces the whole set, so a set half-spent leaves no residue. */
  async reissueRecoveryCodes(command: ReissueRecoveryCodesCommand): Promise<readonly string[]> {
    const minted = mintRecoveryCodes();

    await this.reauthenticate(command);

    return this.store.run(async (tx) => {
      const enrolment = await tx.findTotpEnrolment(command.accountId);
      if (enrolment === null || enrolment.confirmedAt === null) throw new TotpNotEnrolledError();

      await tx.replaceRecoveryCodes(command.accountId, minted.hashes);
      return minted.values;
    });
  }

  /** What S-28 reads. Never the secret, and never the codes. */
  async state(accountId: string): Promise<TotpState> {
    return this.store.run(async (tx) => {
      const enrolment = await tx.findTotpEnrolment(accountId);
      const enrolled = enrolment !== null && enrolment.confirmedAt !== null;
      return {
        enrolled,
        recoveryCodesRemaining: enrolled ? await tx.countUnspentRecoveryCodes(accountId) : 0,
      };
    });
  }
}

/**
 * UC-195 — spend one recovery code, or refuse.
 *
 * **Separate from `ManageTotp` because its caller is, and will be, sign-in.** Task 27.3 folds the
 * challenge into task 21's `SignIn`, and that use case must reach one narrow operation rather than
 * a class carrying four password-gated management methods it has no business calling. This is
 * `ISP` applied at the point it actually costs something.
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

  async execute(command: { readonly accountId: string; readonly code: string }): Promise<boolean> {
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
