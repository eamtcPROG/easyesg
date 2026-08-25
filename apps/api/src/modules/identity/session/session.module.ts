import { Module, type Provider } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { JwtAccessTokenSigner } from '@api/infrastructure/adapters/token-signer/jwt-access-token.signer';
import { SessionStoreRepository } from '@api/infrastructure/persistence/identity/session-store.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { SessionController } from './controllers/session.controller';
import { AuthGuard } from './guards/auth.guard';
import {
  REQUEST_IDENTITY_STORE,
  type RequestIdentityStore,
} from './interfaces/request-identity-store.interface';
import { RequestIdentityStoreRepository } from '@api/infrastructure/persistence/identity/request-identity-store.repository';
import {
  ACCESS_TOKEN_SIGNER,
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenSigner,
  type AccessTokenVerifier,
} from './interfaces/access-token-signer.interface';
import { SESSION_STORE, type SessionStore } from './interfaces/session-store.interface';
import { SessionService } from './services/session.service';
import { RefreshSession } from './use-cases/refresh-session.use-case';
import { SignIn } from './use-cases/sign-in.use-case';
import { SignOut } from './use-cases/sign-out.use-case';

/**
 * `identity/session` — FR-4, FR-5 (UC-04, UC-06, UC-07's server half); AD-12.
 *
 * Short-lived access tokens; opaque server-side refresh sessions rotated on use; sign-in with
 * §12.5.6's throttle and lockout. `AccountModule`'s wiring notes are the pattern followed here —
 * `useFactory` for the framework-free use cases, providers split by entrypoint. This module is
 * HTTP-only in substance: the worker holds no session and signs nothing, so `MODE=worker`
 * registers nothing at all, and neither §9.1 secret ever reaches that container.
 *
 * **`PASSWORD_HASHER` is provided here as well as in `AccountModule`, and that is two providers
 * of one adapter, not two adapters.** Both construct `Argon2PasswordHasher` from the same
 * `auth.passwordPepper`, so the digests are interchangeable by construction. The alternative —
 * exporting the token from `AccountModule` — would make sign-in's hasher an import of the
 * registration module's wiring; the port lives in the account module either way, which is the
 * coupling that matters.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  SessionService,
  { provide: SESSION_STORE, useClass: SessionStoreRepository },
  /** One clock for the module — see `AccountModule`'s equivalent (P-7). */
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: PASSWORD_HASHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new Argon2PasswordHasher(config.get('auth.passwordPepper', { infer: true })),
  },
  {
    provide: ACCESS_TOKEN_SIGNER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      // Throws at boot when AUTH_JWT_SECRET is absent, like the pepper — and like it, preview
      // mode (`emit-openapi.ts`) instantiates no provider, so the hermetic gates need no secret.
      new JwtAccessTokenSigner(config.get('auth.jwtSecret', { infer: true })),
  },
  /**
   * **One adapter instance behind two tokens** (task 28.1). `JwtAccessTokenSigner` implements both
   * ports, and they are registered separately so a consumer depends only on the half it uses:
   * `SignIn` and `RefreshSession` inject the signer, `AuthGuard` injects the verifier. `useExisting`
   * rather than a second `useFactory` — two instances would each construct a `JwtService` from the
   * same secret, which is one object too many holding it.
   */
  { provide: ACCESS_TOKEN_VERIFIER, useExisting: ACCESS_TOKEN_SIGNER },
  { provide: REQUEST_IDENTITY_STORE, useClass: RequestIdentityStoreRepository },
  {
    provide: AuthGuard,
    inject: [Reflector, ACCESS_TOKEN_VERIFIER, REQUEST_IDENTITY_STORE, CLOCK],
    useFactory: (
      reflector: Reflector,
      verifier: AccessTokenVerifier,
      store: RequestIdentityStore,
      now: Clock,
    ) => new AuthGuard(reflector, verifier, store, now),
  },
  {
    provide: SignIn,
    inject: [SESSION_STORE, PASSWORD_HASHER, ACCESS_TOKEN_SIGNER, CLOCK],
    useFactory: (
      store: SessionStore,
      hasher: PasswordHasher,
      signer: AccessTokenSigner,
      now: Clock,
    ) => new SignIn(store, hasher, signer, now),
  },
  {
    provide: RefreshSession,
    inject: [SESSION_STORE, ACCESS_TOKEN_SIGNER, CLOCK],
    useFactory: (store: SessionStore, signer: AccessTokenSigner, now: Clock) =>
      new RefreshSession(store, signer, now),
  },
  {
    provide: SignOut,
    inject: [SESSION_STORE, CLOCK],
    useFactory: (store: SessionStore, now: Clock) =>
      new SignOut(store, now),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [SessionController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
  exports: mode === APP_MODE.WORKER ? [] : [AuthGuard],
})
export class SessionModule {}
