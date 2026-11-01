import { ApiProperty } from '@nestjs/swagger';
import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';
import type { IdentityProviderPublication } from '../models/identity-provider.model';

/**
 * The configuration revision an A-18 write just put in force (task 67.11). **`id` is the configuration version's**,
 * which is what the system audit log's row names — a provider has no id of its own to name.
 */
export class IdentityProviderPublicationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The configuration version now in force.' })
  readonly id: string;

  @ApiProperty({ enum: Object.values(SOCIAL_PROVIDER) })
  readonly provider: SocialProvider;

  @ApiProperty({ type: Number, description: 'Its revision — what the next change is made against.' })
  readonly revision: number;

  constructor(publication: IdentityProviderPublication) {
    this.id = publication.id;
    this.provider = publication.provider;
    this.revision = publication.revision;
  }
}
