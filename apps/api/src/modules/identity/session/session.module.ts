import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { JwtAccessTokenSigner } from '@api/infrastructure/adapters/token-signer/jwt-access-token.signer';
import { SessionStoreRepository } from '@api/infrastructure/persistence/identity/session-store.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { SessionController } from './controllers/session.controller';
import {
  ACCESS_TOKEN_SIGNER,
  type AccessTokenSigner,
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
  {
    provide: SignIn,
    inject: [SESSION_STORE, PASSWORD_HASHER, ACCESS_TOKEN_SIGNER],
    useFactory: (store: SessionStore, hasher: PasswordHasher, signer: AccessTokenSigner) =>
      new SignIn(store, hasher, signer, () => new Date()),
  },
  {
    provide: RefreshSession,
    inject: [SESSION_STORE, ACCESS_TOKEN_SIGNER],
    useFactory: (store: SessionStore, signer: AccessTokenSigner) =>
      new RefreshSession(store, signer, () => new Date()),
  },
  {
    provide: SignOut,
    inject: [SESSION_STORE],
    useFactory: (store: SessionStore) => new SignOut(store, () => new Date()),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [SessionController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class SessionModule {}
