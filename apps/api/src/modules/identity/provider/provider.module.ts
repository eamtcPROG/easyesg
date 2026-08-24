import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { OpenIdClientIdentityProvider } from '@api/infrastructure/adapters/identity-provider/openid-client-identity-provider.adapter';
import { JwtAccessTokenSigner } from '@api/infrastructure/adapters/token-signer/jwt-access-token.signer';
import { SocialSignInStoreRepository } from '@api/infrastructure/persistence/identity/social-sign-in-store.repository';
import {
  ACCESS_TOKEN_SIGNER,
  type AccessTokenSigner,
} from '@api/modules/identity/session/interfaces/access-token-signer.interface';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import {
  IDENTITY_PROVIDER_PORT,
  type IdentityProviderPort,
} from '@api/contracts/identity-provider.port';
import { SocialAuthController } from './controllers/social-auth.controller';
import {
  SOCIAL_PROVIDER_CATALOG,
  type SocialProviderCatalog,
} from './interfaces/social-provider-catalog.interface';
import {
  SOCIAL_SIGN_IN_STORE,
  type SocialSignInStore,
} from './interfaces/social-sign-in-store.interface';
import { SocialProviderCatalogService } from './services/social-provider-catalog.service';
import { SocialAuthService } from './services/social-auth.service';
import { BeginSocialSignIn } from './use-cases/begin-social-sign-in.use-case';
import { CompleteSocialSignIn } from './use-cases/complete-social-sign-in.use-case';

/**
 * `identity/provider` — FR-2, FR-4's social half, FR-82 (UC-02, UC-05, UC-70's data substrate);
 * task 24, §12.5.6's task-24 rows.
 *
 * OIDC identities matched on subject identifier, never on email. `SessionModule`'s wiring notes
 * hold — `useFactory` for the framework-free use cases, HTTP-only in substance (the worker
 * neither signs in nor talks to a provider), and `ACCESS_TOKEN_SIGNER` provided here as well as
 * there is two providers of one adapter from one secret, not two adapters (its header owns that
 * argument).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  SocialAuthService,
  { provide: SOCIAL_PROVIDER_CATALOG, useClass: SocialProviderCatalogService },
  { provide: SOCIAL_SIGN_IN_STORE, useClass: SocialSignInStoreRepository },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: IDENTITY_PROVIDER_PORT,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new OpenIdClientIdentityProvider(
        config.get('auth.social.allowInsecureIssuers', { infer: true }),
      ),
  },
  {
    provide: ACCESS_TOKEN_SIGNER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new JwtAccessTokenSigner(config.get('auth.jwtSecret', { infer: true })),
  },
  {
    provide: BeginSocialSignIn,
    inject: [SOCIAL_PROVIDER_CATALOG, IDENTITY_PROVIDER_PORT],
    useFactory: (catalog: SocialProviderCatalog, port: IdentityProviderPort) =>
      new BeginSocialSignIn(catalog, port),
  },
  {
    provide: CompleteSocialSignIn,
    inject: [
      SOCIAL_PROVIDER_CATALOG,
      IDENTITY_PROVIDER_PORT,
      SOCIAL_SIGN_IN_STORE,
      ACCESS_TOKEN_SIGNER,
      CLOCK,
    ],
    useFactory: (
      catalog: SocialProviderCatalog,
      port: IdentityProviderPort,
      store: SocialSignInStore,
      signer: AccessTokenSigner,
      now: Clock,
    ) => new CompleteSocialSignIn(catalog, port, store, signer, now),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [SocialAuthController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class ProviderModule {}
