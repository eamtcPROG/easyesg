import { Inject, Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  isSocialProvider,
  type ProviderAuthorizationChallenge,
  type SocialProvider,
} from '@api/contracts/identity-provider.port';
import type { IssuedSession } from '@api/modules/identity/session/models/session.model';
import { SocialProviderUnavailableError } from '../errors/social.errors';
import {
  SOCIAL_PROVIDER_CATALOG,
  type SocialProviderCatalog,
} from '../interfaces/social-provider-catalog.interface';
import {
  BeginSocialSignIn,
  type BeginSocialSignInCommand,
} from '../use-cases/begin-social-sign-in.use-case';
import {
  CompleteSocialSignIn,
  type CompleteSocialSignInCommand,
} from '../use-cases/complete-social-sign-in.use-case';

/** The commands minus this layer's ambient fields (`AccountService` documents the derivation),
 *  and with the provider still a wire string — narrowing it is this seam's first job. */
type SocialAuthInput<C> = Omit<C, 'provider' | 'locale' | 'clientIp'> & {
  readonly provider: string;
};

/**
 * The module's service — the controllers-call-services seam (house rule). Three jobs beyond
 * pass-through: narrow the path's provider string into the closed vocabulary (an unknown
 * provider answers exactly like a disabled one, so a probe cannot map the registry), resolve
 * the ambient request context the use cases must not reach for (locale, client address), and
 * expose the catalog's enabled set for S-01.
 */
@Injectable()
export class SocialAuthService {
  constructor(
    private readonly beginSocialSignIn: BeginSocialSignIn,
    private readonly completeSocialSignIn: CompleteSocialSignIn,
    @Inject(SOCIAL_PROVIDER_CATALOG) private readonly catalog: SocialProviderCatalog,
  ) {}

  enabledProviders(): SocialProvider[] {
    return this.catalog.enabledProviders();
  }

  begin(input: SocialAuthInput<BeginSocialSignInCommand>): Promise<ProviderAuthorizationChallenge> {
    return this.beginSocialSignIn.execute({
      ...input,
      provider: this.narrowProvider(input.provider),
    });
  }

  complete(input: SocialAuthInput<CompleteSocialSignInCommand>): Promise<IssuedSession> {
    return this.completeSocialSignIn.execute({
      ...input,
      provider: this.narrowProvider(input.provider),
      // The locale negotiated for this request (OQ-46) seeds FR-10's preference when the flow
      // registers; the address feeds §12.5.6's window — both ambient, both resolved here.
      locale: requestContext()?.locale ?? SOURCE_LOCALE,
      clientIp: requestContext()?.clientIp,
    });
  }

  private narrowProvider(provider: string): SocialProvider {
    if (!isSocialProvider(provider)) throw new SocialProviderUnavailableError();
    return provider;
  }
}
