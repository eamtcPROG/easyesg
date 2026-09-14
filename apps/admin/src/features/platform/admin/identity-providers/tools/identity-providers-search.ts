import { isSocialProvider, type SocialProvider } from '@easyesg/contracts';

/**
 * A-18's addressable state (task 67.11; UX-4): the provider whose record is open. **A value this screen does not
 * understand is dropped**, so a stale or hand-edited address shows the list rather than an error.
 */
export interface IdentityProvidersSearch {
  readonly provider?: SocialProvider;
}

export const readIdentityProvidersSearch = (raw: Record<string, unknown>): IdentityProvidersSearch =>
  typeof raw.provider === 'string' && isSocialProvider(raw.provider) ? { provider: raw.provider } : {};

export const withProvider = (
  search: IdentityProvidersSearch,
  provider: SocialProvider | null,
): IdentityProvidersSearch => readIdentityProvidersSearch({ ...search, provider: provider ?? undefined });
