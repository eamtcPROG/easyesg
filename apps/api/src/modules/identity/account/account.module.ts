import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { AccountStoreRepository } from '@api/infrastructure/persistence/identity/account-store.repository';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import { SECRET_CIPHER } from '@api/contracts/secret-cipher.port';
import { AuthController } from './controllers/auth.controller';
import { TotpController } from './controllers/totp.controller';
import { PasswordResetEmailHandler } from './consumers/password-reset-email.handler';
import { VerificationEmailHandler } from './consumers/verification-email.handler';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { ACCOUNT_STORE, type AccountStore } from './interfaces/account-store.interface';
import { AccountService } from './services/account.service';
import { TotpService } from './services/totp.service';
import { PASSWORD_HASHER, type PasswordHasher } from './interfaces/password-hasher.interface';
import { RegisterAccount } from './use-cases/register-account.use-case';
import { RequestPasswordReset } from './use-cases/request-password-reset.use-case';
import { ResendVerificationEmail } from './use-cases/resend-verification-email.use-case';
import { ResetPassword } from './use-cases/reset-password.use-case';
import { AccountSecondFactor } from './use-cases/account-second-factor';
import { ConsumeRecoveryCode, ManageTotp } from './use-cases/manage-totp.use-case';
import { SECOND_FACTOR } from './interfaces/second-factor.interface';
import { VerifyEmail } from './use-cases/verify-email.use-case';

/**
 * `identity/account` — FR-1 … FR-12, FR-56 … FR-60
 *
 * Registration, email verification, password reset. Uniform responses regardless of account
 * existence (NFR-64) — **with one recorded exception**: registration answers `409` on a duplicate
 * address, because NFR-64's uniform-response clause cites FR-4, FR-6 and FR-11 and not FR-1
 * (OQ-53, closed 20 Aug 2026).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * ## Two things about this wiring that are the pattern, not incidental
 *
 * **Use cases are constructed by `useFactory`, not registered with `useClass`.** They carry no
 * `@Injectable()` because `domain-free-of-frameworks` forbids a NestJS import in `use-cases/`, so
 * there is no constructor metadata for Nest to read. That is the cost of the constraint and it is
 * worth paying: every branch in `RegisterAccount` is reachable in a unit test with three closures
 * and no container. The clock is injected for the same reason — OQ-52's 7-day window is otherwise
 * only testable by waiting a week.
 *
 * **Providers are split by entrypoint**, as `OutboxModule` already splits the dispatcher (AD-1,
 * §5.4: one image, two roles chosen by `MODE`). The split is least privilege rather than tidiness.
 * The HTTP tier hashes passwords and needs §9.1's pepper; it never sends mail, and giving it
 * `EMAIL_PROVIDER` credentials would be a second copy of a secret with no caller. The worker sends
 * mail and needs the provider; it never hashes a password, and holding the pepper would put the
 * value that protects every credential in a container that has no use for it.
 */
const { mode } = configuration();

/**
 * The request side: the service the controller calls, the use cases it orchestrates, and what
 * they depend on. The controller reaches only `AccountService` — controllers call services,
 * services call use cases (house rule, 20 Aug 2026).
 */
const httpProviders: Provider[] = [
  AccountService,
  TotpService,
  { provide: ACCOUNT_STORE, useClass: AccountStoreRepository },
  {
    /**
     * The store seals `identity.totp_credential.secret` (task 27.1's `SecretCipher`), so the
     * repository needs it wherever it is constructed. Registered here as well as in `AdminModule`
     * — two providers of one adapter, not two adapters, both built from the same
     * `SECRET_ENCRYPTION_KEY`, which is `session.module.ts`'s standing answer for
     * `PASSWORD_HASHER`. Ciphertext from either is readable by the other by construction.
     */
    provide: SECRET_CIPHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new AesGcmSecretCipher(config.get('secrets.encryptionKey', { infer: true })),
  },
  {
    provide: PASSWORD_HASHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      // Throws at construction — that is, at boot — when the pepper is absent, rather than
      // producing a hash that is not the one §9.1 specifies. `emit-openapi.ts` runs in preview
      // mode and instantiates no provider, so the hermetic gates still need no secret.
      new Argon2PasswordHasher(config.get('auth.passwordPepper', { infer: true })),
  },
  /**
   * One clock for the module (P-7, `contracts/clock.port.ts`). It replaced `() => new Date()`
   * written at each factory: five copies of one decision, and no way for a test to move time for
   * the module as a whole without re-wiring every use case individually.
   */
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: ManageTotp,
    inject: [ACCOUNT_STORE, PASSWORD_HASHER, CLOCK],
    useFactory: (store: AccountStore, hasher: PasswordHasher, now: Clock) =>
      new ManageTotp(store, hasher, now),
  },
  {
    /**
     * Registered here although its only caller is task 27.3's sign-in, in `identity/session`.
     * The recovery codes are this module's data and this module's hashing rule; exporting the
     * narrow use case is what lets the session module answer a challenge without reaching for
     * `ManageTotp`'s four password-gated management methods (ISP).
     */
    provide: ConsumeRecoveryCode,
    inject: [ACCOUNT_STORE, CLOCK],
    useFactory: (store: AccountStore, now: Clock) => new ConsumeRecoveryCode(store, now),
  },
  {
    /**
     * `SecondFactor` for `identity/session`'s sign-in (task 27.3), **exported** rather than
     * rebuilt there.
     *
     * This is deliberately not the `PASSWORD_HASHER` treatment. That token is duplicated across
     * both modules because a hasher is a shared *mechanism* that neither module owns, built from
     * one config value — two providers of one adapter. A second factor is not that: it is this
     * module's capability over this module's tables and this module's hashing rule, and the port
     * says so. Rebuilding it in `SessionModule` would mean copying the store, the cipher and the
     * recovery-code use case into a module that owns none of them, and the two copies could then
     * disagree about what "enrolled" means.
     */
    provide: SECOND_FACTOR,
    inject: [ACCOUNT_STORE, ConsumeRecoveryCode, CLOCK],
    useFactory: (store: AccountStore, consume: ConsumeRecoveryCode, now: Clock) =>
      new AccountSecondFactor(store, consume, now),
  },
  {
    provide: RegisterAccount,
    inject: [ACCOUNT_STORE, PASSWORD_HASHER, CLOCK],
    useFactory: (store: AccountStore, hasher: PasswordHasher, now: Clock) =>
      new RegisterAccount(store, hasher, now),
  },
  {
    provide: VerifyEmail,
    inject: [ACCOUNT_STORE, CLOCK],
    useFactory: (store: AccountStore, now: Clock) =>
      new VerifyEmail(store, now),
  },
  {
    provide: ResendVerificationEmail,
    inject: [ACCOUNT_STORE, CLOCK],
    useFactory: (store: AccountStore, now: Clock) =>
      new ResendVerificationEmail(store, now),
  },
  {
    provide: RequestPasswordReset,
    inject: [ACCOUNT_STORE, CLOCK],
    useFactory: (store: AccountStore, now: Clock) =>
      new RequestPasswordReset(store, now),
  },
  {
    provide: ResetPassword,
    inject: [ACCOUNT_STORE, PASSWORD_HASHER, CLOCK],
    useFactory: (store: AccountStore, hasher: PasswordHasher, now: Clock) =>
      new ResetPassword(store, hasher, now),
  },
];

/** The worker side: whatever `OutboxConsumer` routes to this module by job name. */
const workerProviders: Provider[] = [VerificationEmailHandler, PasswordResetEmailHandler];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  // `SECOND_FACTOR` only — the sign-in path asks two questions and gets exactly two methods
  // (ISP). Nothing else here is exported, so `ManageTotp`'s password-gated methods stay
  // unreachable from an unauthenticated route.
  exports: mode === APP_MODE.WORKER ? [] : [SECOND_FACTOR],
  controllers: mode === APP_MODE.WORKER ? [] : [AuthController, TotpController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
})
export class AccountModule {}
