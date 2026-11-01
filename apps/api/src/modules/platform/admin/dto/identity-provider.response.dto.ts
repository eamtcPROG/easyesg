import { ApiProperty } from '@nestjs/swagger';
import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';
import type { EpochMillis } from '@api/contracts/types/time';
import {
  IDENTITY_PROVIDER_ENABLEMENT_BLOCKER,
  type IdentityProviderConfiguration,
  type IdentityProviderEnablementBlocker,
} from '../models/identity-provider.model';

/**
 * One provider as A-18 shows it (task 67.11; UC-70, FR-82). **Its two halves are both here and never mixed**:
 * the configuration in force, which the console edits, and what the server holds of the client secret — whether,
 * and where it is set — which the console cannot edit and never reads back.
 */
export class IdentityProviderResponseDto {
  @ApiProperty({ enum: Object.values(SOCIAL_PROVIDER), description: 'The provider — Google or Microsoft (FR-2).' })
  readonly provider: SocialProvider;

  @ApiProperty({
    description:
      'Whether sign-in, registration and linking through the provider are offered. Changed only by the ' +
      'enablement and disablement routes, never by a configuration save.',
  })
  readonly enabled: boolean;

  @ApiProperty({ description: 'The client ID the provider issued; empty until the provider is registered.' })
  readonly clientId: string;

  @ApiProperty({ description: 'The OIDC issuer discovery runs against; empty until the provider is configured.' })
  readonly issuer: string;

  @ApiProperty({ type: [String], description: 'The scopes requested — the three FR-2 names, not editable here.' })
  readonly scopes: string[];

  @ApiProperty({ type: [String], description: 'The exact redirect addresses a sign-in may return to.' })
  readonly redirectUris: string[];

  @ApiProperty({
    type: Number,
    description:
      'The configuration revision in force, sent back with a change so that a newer one refuses it. 0 before ' +
      'anything was published for the provider.',
  })
  readonly revision: number;

  @ApiProperty({
    enum: Object.values(IDENTITY_PROVIDER_ENABLEMENT_BLOCKER),
    nullable: true,
    description:
      'The first reason the provider could not sign anyone in — no client ID, no redirect address, or no ' +
      'client secret held — or null when it could. Set for an enabled provider too, whose secret may since have ' +
      'left the environment.',
  })
  readonly enablementBlocker: IdentityProviderEnablementBlocker | null;

  @ApiProperty({ description: 'Whether the server holds the provider’s client secret. Never the secret itself.' })
  readonly secretHeld: boolean;

  @ApiProperty({
    example: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET',
    description:
      'The environment variable that holds the client secret — where it is set, since this surface cannot set ' +
      'it. A change to it takes effect when the server restarts.',
  })
  readonly secretSetting: string;

  @ApiProperty({ type: Number, description: 'Accounts holding an identity through the provider.' })
  readonly linkedAccounts: number;

  @ApiProperty({
    type: Number,
    description:
      'Of those, the accounts with no password and no other provider — which, once the provider is disabled, ' +
      'sign in again only by resetting their password.',
  })
  readonly accountsWithoutOtherCredential: number;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description: 'The operator who published the configuration in force. Null for a seeded configuration.',
  })
  readonly changedByEmail: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix epoch milliseconds when the configuration in force was published.',
  })
  readonly changedAt: EpochMillis | null;

  constructor(configuration: IdentityProviderConfiguration) {
    this.provider = configuration.provider;
    this.enabled = configuration.settings.enabled;
    this.clientId = configuration.settings.clientId;
    this.issuer = configuration.settings.issuer;
    this.scopes = [...configuration.settings.scopes];
    this.redirectUris = [...configuration.settings.redirectUris];
    this.revision = configuration.revision;
    this.enablementBlocker = configuration.enablementBlocker;
    this.secretHeld = configuration.secret.held;
    this.secretSetting = configuration.secret.setting;
    this.linkedAccounts = configuration.usage.linkedAccounts;
    this.accountsWithoutOtherCredential = configuration.usage.accountsWithoutOtherCredential;
    this.changedByEmail = configuration.changedByEmail;
    this.changedAt = configuration.changedAt === null ? null : configuration.changedAt.getTime();
  }
}
