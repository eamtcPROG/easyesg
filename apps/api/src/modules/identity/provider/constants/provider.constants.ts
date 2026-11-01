import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';

/**
 * The configuration store `kind` under which each social provider's behaviour lives, one entry
 * per provider with the provider as its `scope` (FR-82, §12.5.6's task-24 configuration row).
 * Seeded from `config/seed/identity-provider.<provider>.json` — the seed loader turns filename
 * dashes into underscores, so the kind is spelled with one here. Edited by A-18 since task 67.11.
 */
export const IDENTITY_PROVIDER_CONFIG_KIND = 'identity_provider';

/**
 * Where each provider's client secret is set: the environment variable `config/configuration.ts` reads it
 * from (§12.5.6's task-24 configuration row).
 *
 * **Named here because A-18 shows it** (task 67.11). The secret is the one half of a provider the console
 * cannot edit, so the screen says where it lives — and a name restated in the console's copy would be free
 * to disagree with the variable the api actually reads. `provider.constants.spec.ts` holds the two
 * together. Task 154 moves the secret into OpenBao, and this becomes the path there.
 */
export const SOCIAL_CLIENT_SECRET_SETTING = {
  [SOCIAL_PROVIDER.GOOGLE]: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET',
  [SOCIAL_PROVIDER.MICROSOFT]: 'AUTH_SOCIAL_MICROSOFT_CLIENT_SECRET',
} as const satisfies Record<SocialProvider, string>;
