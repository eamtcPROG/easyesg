import { ApiProperty } from '@nestjs/swagger';
import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';

/**
 * `GET /api/v1/auth/social/providers` (FR-82; task 24): the set S-01 renders — currently enabled
 * providers, in declaration order. Disabling one through the configuration store removes it here
 * within the ≤5 s propagation window, with no redeploy; that is the FR's outage valve.
 */
export class SocialProvidersResponseDto {
  @ApiProperty({
    enum: Object.values(SOCIAL_PROVIDER),
    isArray: true,
    description: 'Providers currently accepting sign-in and registration.',
  })
  readonly providers: SocialProvider[];

  constructor(providers: SocialProvider[]) {
    this.providers = providers;
  }
}
