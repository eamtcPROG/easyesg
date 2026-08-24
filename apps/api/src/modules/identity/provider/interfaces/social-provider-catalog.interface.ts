import type { SocialProvider, SocialProviderSettings } from '@api/contracts/identity-provider.port';

/**
 * How the use cases see FR-82: a provider is either resolvable — enabled or not, with its
 * settings — or unknown. The implementation joins the configuration store's payload (behaviour,
 * changeable with no redeploy) with the environment's client secret (§12.5.6's task-24
 * configuration row); the use case neither knows nor cares which half a field came from, which
 * is what lets task 67 move the secret into OpenBao without touching a flow.
 *
 * Synchronous because the configuration store answers from its cached in-force view (AD-4's
 * read model) and the environment is process state — nothing here waits.
 */
export interface SocialProviderCatalog {
  resolve(provider: SocialProvider): SocialProviderSettings | null;

  /** S-01's list (design_spec: "the set of currently enabled identity providers"), in declaration order. */
  enabledProviders(): SocialProvider[];
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SOCIAL_PROVIDER_CATALOG = Symbol('SOCIAL_PROVIDER_CATALOG');
