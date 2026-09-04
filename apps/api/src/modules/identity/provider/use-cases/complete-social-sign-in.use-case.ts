import { unverifiedAccountHasExpired } from '@api/modules/identity/account/domain/account-expiry';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  socialSignInThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { emailIdentityKey, normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  ACCOUNT_STATUS,
  type Account,
} from '@api/modules/identity/account/models/account.model';
import { issueVerificationChallenge } from '@api/modules/identity/account/use-cases/issue-verification-challenge';
import { finaliseIssuedSession } from '@api/modules/identity/session/domain/issue-session';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AccessTokenSigner } from '@api/modules/identity/session/interfaces/access-token-signer.interface';
import type { IssuedSession, Session } from '@api/modules/identity/session/models/session.model';
import type { Locale } from '@easyesg/i18n';
import type {
  IdentityProviderPort,
  ProviderAssertion,
  SocialProvider,
} from '@api/contracts/identity-provider.port';
import type { Clock } from '@api/contracts/clock.port';
import {
  SocialEmailInUseError,
  SocialEmailUnverifiedError,
  SocialIdentityUnknownError,
  SocialProviderUnavailableError,
  SocialRedirectRejectedError,
} from '../errors/social.errors';
import type { SocialProviderCatalog } from '../interfaces/social-provider-catalog.interface';
import type {
  SocialSignInStore,
  SocialSignInTransaction,
} from '../interfaces/social-sign-in-store.interface';
import {
  SOCIAL_SIGN_IN_INTENT,
  type SocialSignInIntent,
} from '../models/provider-identity.model';

export interface CompleteSocialSignInCommand {
  readonly provider: SocialProvider;
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly intent: SocialSignInIntent;
  /** Negotiated from `Accept-Language`; seeds FR-10's preference when registration happens. */
  readonly locale: Locale;
  /** For §12.5.6's window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * The resolution discriminator — in-file and unexported, per the closed-vocabulary rule's
 * placement clause: no other file reads it, so a constants home would be the over-correction
 * the rule names.
 */
const RESOLUTION = {
  ISSUED: 'issued',
  VERIFICATION_REQUIRED: 'verification-required',
} as const;

/** What the one transaction decides — thrown or finalised only AFTER it commits (see below). */
type SocialSignInResolution =
  | {
      readonly kind: typeof RESOLUTION.ISSUED;
      readonly account: Account;
      readonly session: Session;
      readonly refreshTokenValue: string;
    }
  | { readonly kind: typeof RESOLUTION.VERIFICATION_REQUIRED };

/**
 * UC-02 and UC-05's second half: redeem the callback, then either sign in, register, or answer
 * with the one refusal each spec branch names (FR-2, FR-4; BR-ID-3).
 *
 * Framework-free, constructed by `useFactory`. Structure inherits `SignIn`'s two commitments:
 *
 * **Several short transactions where durability and refusal disagree.** The throttle gate commits
 * before the exchange, so a refused attempt still counted. The main resolution runs in ONE
 * transaction — UC-02's registration is account + identity + challenge + outbox row + session,
 * and P-8 wants all or none — but it RETURNS outcomes rather than throwing where something must
 * survive: the unverified-registration path commits an account and its emailed challenge while
 * the request answers 403, and a throw inside `run` would roll back the very account the email
 * names. Refusals that write nothing (`SocialEmailInUseError`, `SocialIdentityUnknownError`)
 * throw from inside, which at worst rolls back an expired-account reclaim — re-done harmlessly
 * on the next attempt.
 *
 * **Match on the subject, never the email** (UC-05, §9.1): the email is looked at only when no
 * identity matches, and then only to decide between collision (BR-ID-3 — an assertion alone never
 * attaches to an existing account) and registration. The asserted email drifting from the
 * account's is expected and recorded, not resolved.
 *
 * Password lockout deliberately does NOT gate this path: the lock is a state of the password
 * credential after guessed passwords, and FR-82's "existing accounts able to authenticate by
 * another credential" names provider identities as exactly that other credential. A provider
 * identity cannot be guessed here — the provider authenticated it.
 */
export class CompleteSocialSignIn {
  constructor(
    private readonly catalog: SocialProviderCatalog,
    private readonly providerPort: IdentityProviderPort,
    private readonly store: SocialSignInStore,
    private readonly signer: AccessTokenSigner,
    private readonly now: Clock,
  ) {}

  async execute(command: CompleteSocialSignInCommand): Promise<IssuedSession> {
    const settings = this.catalog.resolve(command.provider);
    if (!settings?.enabled) throw new SocialProviderUnavailableError();
    if (!settings.redirectUris.includes(command.redirectUri)) {
      throw new SocialRedirectRejectedError();
    }

    const now = this.now();
    const limited = await this.store.run(async (tx) => {
      const key = socialSignInThrottleKey(command.clientIp, command.provider);
      const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
      if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) return true;
      await tx.recordAuthAttempt(key, now);
      return false;
    });
    if (limited) throw new AuthRateLimitedError();

    // Outside any transaction: a provider round trip must never hold a pooled connection
    // (the Argon2id argument in `RegisterAccount`, with a network wait in place of CPU).
    const assertion = await this.providerPort.exchangeCode({
      settings,
      redirectUri: command.redirectUri,
      code: command.code,
      state: command.state,
      nonce: command.nonce,
      codeVerifier: command.codeVerifier,
    });

    const resolution = await this.store.run((tx) => this.resolve(tx, command, assertion, now));
    if (resolution.kind === RESOLUTION.VERIFICATION_REQUIRED) throw new SocialEmailUnverifiedError();

    return finaliseIssuedSession(
      {
        account: resolution.account,
        session: resolution.session,
        refreshTokenValue: resolution.refreshTokenValue,
        now,
      },
      this.signer,
    );
  }

  private async resolve(
    tx: SocialSignInTransaction,
    command: CompleteSocialSignInCommand,
    assertion: ProviderAssertion,
    now: Date,
  ): Promise<SocialSignInResolution> {
    const identity = await tx.findProviderIdentity(command.provider, assertion.subject);

    if (identity) {
      const account = await tx.findAccountById(identity.accountId);
      // The FK makes a dangling identity unrepresentable; this narrows the type, not the world.
      if (account !== null) {
        if (
          account.status === ACCOUNT_STATUS.UNVERIFIED &&
          unverifiedAccountHasExpired(account, now)
        ) {
          // OQ-52: past the window the record behaves exactly like no account. The cascade takes
          // the identity with it, so the flow continues on the unlinked branch below.
          await tx.deleteAccount(account.id);
        } else {
          return this.signInLinked(tx, identity, account, assertion, now);
        }
      }
    }

    const email = normaliseEmail(assertion.email);
    const existing = await tx.findAccountByEmail(email);
    if (existing) {
      if (
        existing.status === ACCOUNT_STATUS.UNVERIFIED &&
        unverifiedAccountHasExpired(existing, now)
      ) {
        await tx.deleteAccount(existing.id);
      } else {
        // UC-02's alternate flow, BR-ID-3: no duplicate, no silent link. The route to linking is
        // proving control of the account first — password sign-in, then linking from S-28, which
        // task 27.6 built: `POST /account/providers/{provider}`, behind the current password.
        throw new SocialEmailInUseError();
      }
    }

    if (command.intent === SOCIAL_SIGN_IN_INTENT.SIGN_IN) {
      // UC-05's alternate flow: offer registration; never silently create an empty account.
      throw new SocialIdentityUnknownError();
    }

    const account = await tx.createProviderAccount({
      email,
      locale: command.locale,
      provider: command.provider,
      subject: assertion.subject,
      assertedEmail: assertion.email,
      emailVerifiedAsserted: assertion.emailVerified,
      // UC-03 satisfied by the provider's assertion, or an ordinary unverified account otherwise.
      verifiedAt: assertion.emailVerified ? now : null,
    });

    if (!assertion.emailVerified) {
      await issueVerificationChallenge(tx, account, now);
      return { kind: RESOLUTION.VERIFICATION_REQUIRED };
    }

    return this.createSessionFor(tx, account, now);
  }

  private async signInLinked(
    tx: SocialSignInTransaction,
    identity: { readonly id: string; readonly assertedEmail: string; readonly emailVerifiedAsserted: boolean },
    account: Account,
    assertion: ProviderAssertion,
    now: Date,
  ): Promise<SocialSignInResolution> {
    if (
      identity.assertedEmail !== assertion.email ||
      identity.emailVerifiedAsserted !== assertion.emailVerified
    ) {
      await tx.refreshProviderAssertion(
        {
          id: identity.id,
          assertedEmail: assertion.email,
          emailVerifiedAsserted: assertion.emailVerified,
        },
        now,
      );
    }

    let resolved = account;
    if (account.status === ACCOUNT_STATUS.UNVERIFIED) {
      // UC-03's alternate reaches a linked-but-unverified account too — but only when the
      // provider vouches for THE ACCOUNT'S OWN address. A verified assertion of some other
      // address the user later switched to proves nothing about the one the account holds.
      const vouchesForAccountAddress =
        assertion.emailVerified &&
        emailIdentityKey(assertion.email) === emailIdentityKey(account.email);
      if (!vouchesForAccountAddress) return { kind: RESOLUTION.VERIFICATION_REQUIRED };
      resolved = await tx.markAccountVerified(account.id, now);
    }

    return this.createSessionFor(tx, resolved, now);
  }

  private async createSessionFor(
    tx: SocialSignInTransaction,
    account: Account,
    now: Date,
  ): Promise<SocialSignInResolution> {
    const minted = mintRefreshToken();
    // **Remembered, and that is OQ-35's recorded sub-decision rather than a default reached for
    // here.** S-01's checkbox sits above the divider and governs the credential form; the provider
    // buttons are plain anchors carrying no client JavaScript (task 24, UX-108), so they cannot
    // carry a value toggled after render. It is also the non-regressing choice — the lifetime every
    // provider session had before this column existed — and it is how UC-05's "identical in scope
    // and lifetime to a password session" reads against the two pairs §12.5.6 now states.
    const session = await tx.createSession({
      accountId: account.id,
      refreshTokenHash: minted.hash,
      remembered: true,
      at: now,
    });
    return { kind: RESOLUTION.ISSUED, account, session, refreshTokenValue: minted.value };
  }
}
