import { ApiProperty } from '@nestjs/swagger';
import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';
import type { ProviderIdentity } from '../models/provider-identity.model';

/**
 * A linked provider as S-28 lists it (FR-8, UC-11).
 *
 * **The subject never leaves the server.** It is the provider's own identifier for a person, it is
 * what UC-05 matches on, and no screen has a use for it — publishing it would put a stable
 * cross-service identifier on a page for the sake of a list that reads perfectly well without one.
 * The asserted email is here because it is what a user recognises: *which* Google account is this.
 */
export class LinkedProviderResponseDto {
  @ApiProperty({ enum: Object.values(SOCIAL_PROVIDER) })
  readonly provider: SocialProvider;

  @ApiProperty({
    format: 'email',
    description:
      'The address the provider asserted at the last sign-in. Deliberately allowed to differ from ' +
      'the account’s own — it is a recorded fact, not an identity — and it is what tells a user ' +
      'which of their provider accounts this is.',
  })
  readonly assertedEmail: string;

  constructor(identity: ProviderIdentity) {
    this.provider = identity.provider;
    this.assertedEmail = identity.assertedEmail;
  }
}
