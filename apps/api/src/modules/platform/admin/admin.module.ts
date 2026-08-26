import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { JwtAdminTokens } from '@api/infrastructure/adapters/token-signer/jwt-admin-tokens';
import { AdminSessionStoreRepository } from '@api/infrastructure/persistence/platform/admin-session-store.repository';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { SECRET_CIPHER } from '@api/contracts/secret-cipher.port';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminSessionController } from './controllers/admin-session.controller';
import { AdminOriginGuard } from './guards/admin-origin.guard';
import {
  ADMIN_SESSION_STORE,
  type AdminSessionStore,
} from './interfaces/admin-session-store.interface';
import { ADMIN_TOKENS, type AdminTokens } from './interfaces/admin-token.interface';
import { AdminSessionService } from './services/admin-session.service';
import { BeginAdminSignIn } from './use-cases/begin-admin-sign-in.use-case';
import { CompleteAdminSignIn } from './use-cases/complete-admin-sign-in.use-case';
import { ResolveAdminSession } from './use-cases/resolve-admin-session.use-case';
import { SignOutAdmin } from './use-cases/sign-out-admin.use-case';

/**
 * `platform/admin` — FR-75, FR-76, FR-80, FR-82, FR-83
 *
 * Platform administration behind the separate admin realm (NFR-65). Task 23 fills in FR-75:
 * the realm's token handler (OQ-17 — `/auth/admin/session` on this api, sealed-cookie
 * sessions, mandatory TOTP per §12.5.6's task-23 rows; reshaped to A-01's two-step credential →
 * factor handshake by the 24 Aug 2026 review). FR-76/80/82/83 are tasks 67–68.
 *
 * **What this module deliberately borrows from `identity`, and why that is not a boundary
 * breach:** the Argon2id hasher port, the refresh-token mint/hash, and the throttle domain
 * (`auth-throttle.ts`, which names its cross-module consumers itself). Those are auth
 * MECHANISMS; NFR-65's separation is about DATA — separate tables, cookie, secret — and §17.5
 * places FR-75's ownership here. What it must never borrow is the tenant session's tables or
 * its `SessionStore`.
 *
 * Wiring follows the house pattern: framework-free use cases built by `useFactory`
 * (`account.module.ts` is the worked example), providers split by entrypoint —
 * `AUTH_ADMIN_SECRET` and the pepper are HTTP-tier secrets, and the worker holds neither.
 */
const { mode } = configuration();

/** Module-local hasher token: the identity module registers its own for its providers, and a
 *  shared global token would be exactly the cross-realm coupling NFR-65 rules out. */
const ADMIN_PASSWORD_HASHER = Symbol('ADMIN_PASSWORD_HASHER');

const httpProviders: Provider[] = [
  AdminSessionService,
  AdminOriginGuard,
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  { provide: ADMIN_SESSION_STORE, useClass: AdminSessionStoreRepository },
  {
    // The store opens `totp_secret` on the way out (task 27.1). Registered here rather than
    // globally because this is the only module holding a sealed column today; task 27.2's
    // tenant secrets register the same adapter in `identity`, under the same one key.
    provide: SECRET_CIPHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new AesGcmSecretCipher(config.get('secrets.encryptionKey', { infer: true })),
  },
  {
    provide: ADMIN_PASSWORD_HASHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new Argon2PasswordHasher(config.get('auth.passwordPepper', { infer: true })),
  },
  {
    provide: ADMIN_TOKENS,
    inject: [ConfigService],
    // Constructed lazily per boot like the tenant signer: emit-openapi's preview mode
    // instantiates no provider, so the hermetic gates need no secret.
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new JwtAdminTokens(config.get('auth.adminSecret', { infer: true })),
  },
  {
    provide: BeginAdminSignIn,
    inject: [ADMIN_SESSION_STORE, ADMIN_PASSWORD_HASHER, CLOCK],
    useFactory: (store: AdminSessionStore, hasher: PasswordHasher, now: Clock) =>
      new BeginAdminSignIn(store, hasher, now),
  },
  {
    provide: CompleteAdminSignIn,
    inject: [ADMIN_SESSION_STORE, ADMIN_TOKENS, CLOCK],
    useFactory: (store: AdminSessionStore, tokens: AdminTokens, now: Clock) =>
      new CompleteAdminSignIn(store, tokens, now),
  },
  {
    provide: ResolveAdminSession,
    inject: [ADMIN_SESSION_STORE, ADMIN_TOKENS, CLOCK],
    useFactory: (store: AdminSessionStore, tokens: AdminTokens, now: Clock) =>
      new ResolveAdminSession(store, tokens, now),
  },
  {
    provide: SignOutAdmin,
    inject: [ADMIN_SESSION_STORE, CLOCK],
    useFactory: (store: AdminSessionStore, now: Clock) => new SignOutAdmin(store, now),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [AdminSessionController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class AdminModule {}
