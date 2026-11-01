import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min } from 'class-validator';

/** Cost bounds, not policy: a client ID, an issuer and a redirect list well past anything a provider issues. */
const CLIENT_ID_MAX = 512;
const ADDRESS_MAX = 2048;
const REDIRECTS_MAX = 10;

/**
 * A-18's configuration save (task 67.11; UC-70). **The enabled state and the scopes are not fields**: the first is
 * the enablement routes' alone, so a save cannot enable a provider past their checks, and the second is FR-2's
 * three, fixed (project owner, 14 Sep 2026).
 */
export class ConfigureIdentityProviderRequestDto {
  @ApiProperty({
    maxLength: CLIENT_ID_MAX,
    description:
      'The client ID the provider issued. Saving the first one registers the provider; saving another rotates ' +
      'it. May be empty while the provider is disabled.',
  })
  @IsString()
  @MaxLength(CLIENT_ID_MAX)
  clientId!: string;

  @ApiProperty({
    maxLength: ADDRESS_MAX,
    example: 'https://accounts.google.com',
    description: 'The OIDC issuer discovery runs against — a complete https address with no query or fragment.',
  })
  @IsString()
  @MaxLength(ADDRESS_MAX)
  issuer!: string;

  @ApiProperty({
    type: [String],
    maxItems: REDIRECTS_MAX,
    description:
      'The exact redirect addresses a sign-in may return to, each ending in `/auth/social/{provider}/callback`. ' +
      'Blank entries and repeats are dropped. May be empty while the provider is disabled.',
  })
  @IsArray()
  @ArrayMaxSize(REDIRECTS_MAX)
  @IsString({ each: true })
  @MaxLength(ADDRESS_MAX, { each: true })
  redirectUris!: string[];

  @ApiProperty({
    type: Number,
    minimum: 0,
    description:
      'The revision this change was made against — the one the reading answered. A newer one in force refuses ' +
      'the change (problem type identity-provider-changed).',
  })
  @IsInt()
  @Min(0)
  revision!: number;
}
