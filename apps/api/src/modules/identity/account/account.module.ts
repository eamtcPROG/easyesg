import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { AccountStoreRepository } from '@api/infrastructure/persistence/identity/account-store.repository';
import { AuthController } from './controllers/auth.controller';
import { PasswordResetEmailHandler } from './consumers/password-reset-email.handler';
import { VerificationEmailHandler } from './consumers/verification-email.handler';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { ACCOUNT_STORE, type AccountStore } from './interfaces/account-store.interface';
import { AccountService } from './services/account.service';
import { PASSWORD_HASHER, type PasswordHasher } from './interfaces/password-hasher.interface';
import { RegisterAccount } from './use-cases/register-account.use-case';
import { RequestPasswordReset } from './use-cases/request-password-reset.use-case';
import { ResendVerificationEmail } from './use-cases/resend-verification-email.use-case';
import { ResetPassword } from './use-cases/reset-password.use-case';
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
  { provide: ACCOUNT_STORE, useClass: AccountStoreRepository },
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
  controllers: mode === APP_MODE.WORKER ? [] : [AuthController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
})
export class AccountModule {}
