import type { Clock } from '@api/contracts/clock.port';
import type {
  IdentityProviderPort,
  SocialProvider,
} from '@api/contracts/identity-provider.port';
import {
  admitAuthAttempt,
  reauthenticationThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import {
  AuthRateLimitedError,
  ReauthenticationFailedError,
} from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  LastCredentialError,
  ProviderIdentityTakenError,
  ProviderNotLinkedError,
  SocialProviderUnavailableError,
  SocialRedirectRejectedError,
} from '../errors/social.errors';
import type { SocialProviderCatalog } from '../interfaces/social-provider-catalog.interface';
import type { SocialSignInStore } from '../interfaces/social-sign-in-store.interface';
import { isLastCredential, type ProviderIdentity } from '../models/provider-identity.model';

/** Ambient fields the service resolves; the `Omit` on each service method lists them. */
interface ActorCommand {
  readonly accountId: string;
  /** Absent only for a provider-only account (FR-2), which holds no password row. */
  readonly password?: string;
  /** For §12.5.6's re-authentication window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

export interface LinkProviderCommand extends ActorCommand {
  readonly provider: SocialProvider;
  /** The OAuth transaction the web tier sealed when the flow began — task 24's values, unchanged. */
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}

export interface UnlinkProviderCommand extends ActorCommand {
  readonly provider: SocialProvider;
}

/**
 * UC-11 and UC-12 — link and unlink provider identities (FR-8; task 27.6).
 *
 * **BR-ID-3 is the reason this class exists and not a route on the sign-in flow.** *A provider
 * assertion alone never attaches to an existing account.* Task 24's completion path enforces that
 * by refusing a register-intent collision outright; this is the other side of the same rule — the
 * assertion attaches only when it arrives on a request that already carries the account, and the
 * account carries it because `AuthGuard` resolved a session rather than because the assertion
 * claimed an address.
 *
 * **Both operations re-authenticate** (§12.5.6's re-authentication row, task 27.5's key). A link
 * adds a *way in*: a stolen session that could attach the attacker's provider would survive the
 * very remedy its owner reaches for, which is to change their password. An unlink removes one, and
 * BR-ID-4 alone does not make that safe — an attacker who strips the owner's other provider
 * narrows them to a credential the attacker may also hold. A provider-only account has no password
 * and there the session stands as the credential, which is task 27.2's recorded assumption
 * unchanged.
 *
 * **The whole of BR-ID-4 happens inside one transaction.** Counting outside it would let two
 * concurrent unlinks each see two credentials and both proceed, leaving an account with none —
 * UC-12's unrecoverable state, reached by a race rather than by a decision.
 */
export class ManageProviderLinks {
  constructor(
    private readonly store: SocialSignInStore,
    private readonly catalog: SocialProviderCatalog,
    private readonly providerPort: IdentityProviderPort,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  /**
   * §12.5.6's rule, outside the caller's transaction for `ChangePassword`'s three reasons: a
   * refusal must durably cost an attempt, Argon2id must not idle a pooled connection, and a nested
   * `run` would hold two connections for one request.
   */
  private async reauthenticate(command: ActorCommand): Promise<void> {
    // One read, not a `has` followed by a `find`: `null` IS the provider-only account.
    const digest = await this.store.run((tx) => tx.findPasswordDigest(command.accountId));
    if (digest === null) return;

    const key = reauthenticationThrottleKey(command.clientIp, command.accountId);
    const admitted = await this.store.run((tx) =>
      admitAuthAttempt(tx, { key, now: this.now() }),
    );
    if (!admitted) throw new AuthRateLimitedError();

    if (command.password === undefined) throw new ReauthenticationFailedError();
    if (!(await this.hasher.verify({ digest, password: command.password }))) {
      throw new ReauthenticationFailedError();
    }
  }

  /**
   * UC-11 steps two and three: redeem the code the provider issued, then attach what it asserts.
   *
   * **Re-authentication happens first, before the exchange.** A caller who cannot prove the account
   * should not be able to spend our token-endpoint round trip at the provider.
   *
   * The redirect URI is checked against the same allowlist `BeginSocialSignIn` checks it against,
   * and repeating it is not redundancy: challenge and completion are separate requests, and a code
   * can be presented honestly against a URI the configuration has since withdrawn — FR-82's
   * disable-without-redeploy makes that a real sequence rather than a contrived one.
   *
   * **It does NOT require the asserted email to match the account's**, and that is a decision. A
   * person's Google address is routinely not their work address, and demanding a match would make
   * linking impossible for exactly the users who most want it. BR-ID-3 is satisfied by the
   * re-authentication above — matching on an email is the account-takeover path §9.1 names.
   */
  async link(command: LinkProviderCommand): Promise<void> {
    await this.reauthenticate(command);

    const settings = this.catalog.resolve(command.provider);
    if (!settings?.enabled) throw new SocialProviderUnavailableError();
    if (!settings.redirectUris.includes(command.redirectUri)) {
      throw new SocialRedirectRejectedError();
    }

    // Outside any transaction, and uncaught: the adapter answers every way the provider or the
    // token can refuse with one `SocialExchangeFailedError` (the port's stated stance), and a
    // provider round trip must never hold a pooled connection — `CompleteSocialSignIn`'s note.
    const assertion = await this.providerPort.exchangeCode({
      settings,
      code: command.code,
      state: command.state,
      nonce: command.nonce,
      codeVerifier: command.codeVerifier,
      redirectUri: command.redirectUri,
    });

    const attached = await this.store.run((tx) =>
      tx.linkProviderIdentity(
        {
          accountId: command.accountId,
          provider: command.provider,
          subject: assertion.subject,
          assertedEmail: assertion.email,
          emailVerifiedAsserted: assertion.emailVerified,
        },
        this.now(),
      ),
    );

    // The unique index decided it. Which account holds the pair is deliberately not disclosed:
    // saying "already linked to another account" names a stranger's, and the caller can do
    // nothing differently either way.
    if (!attached) throw new ProviderIdentityTakenError();
  }

  /** UC-12, with BR-ID-4 counted and applied in one transaction. */
  async unlink(command: UnlinkProviderCommand): Promise<void> {
    await this.reauthenticate(command);

    await this.store.run(async (tx) => {
      const [hasPassword, identities] = await Promise.all([
        tx.hasPasswordCredential(command.accountId),
        tx.findProviderIdentitiesFor(command.accountId),
      ]);

      if (!identities.some((identity) => identity.provider === command.provider)) {
        throw new ProviderNotLinkedError();
      }

      const inventory = {
        hasPassword,
        providers: identities.map((identity) => identity.provider),
      };
      // UC-12's exception flow, and the message names the way out: set a password first.
      if (isLastCredential(inventory, command.provider)) throw new LastCredentialError();

      await tx.unlinkProviderIdentity({
        accountId: command.accountId,
        provider: command.provider,
      });
    });
  }

  /** What S-28 lists. Never the subject — it is the provider's identifier for a person, not ours
   *  to publish, and no screen has a use for it. */
  async linked(accountId: string): Promise<ProviderIdentity[]> {
    return this.store.run((tx) => tx.findProviderIdentitiesFor(accountId));
  }
}
