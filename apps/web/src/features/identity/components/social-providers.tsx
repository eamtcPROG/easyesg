import { getTranslations } from 'next-intl/server';
import { providerGlyph } from './provider-glyphs';
import { providerLabel } from '../social';
import { ProviderButton } from '@easyesg/ui';
import type {
  SocialProvidersResponse,
  SocialSignInIntent,
} from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import styles from './identity-screens.module.css';

/**
 * S-01's provider choices (FR-2, FR-4, D-6; task 24) — "the set of currently enabled identity
 * providers", fetched per render so an FR-82 disable disappears from the screen at the store's
 * propagation speed, not a deploy's. A Server Component: the set is server state and the
 * buttons are plain anchors into the OAuth start route, so nothing here ships to the client
 * bundle.
 *
 * Renders nothing when the set is empty OR the api is unreachable: S-01's email form is the
 * degradation path either way, and a broken provider list must not take password sign-in down
 * with it.
 */
export interface SocialProvidersProps {
  intent: SocialSignInIntent;
  /** Task 22's `?return=` hand-off, threaded through the flow so UX-38 survives the redirect. */
  returnTo?: string;
}

export async function SocialProviders({ intent, returnTo }: SocialProvidersProps) {
  const outcome = await api.get<SocialProvidersResponse>('/auth/social/providers');
  if (outcome.status !== API_OUTCOME.Ok || outcome.value.providers.length === 0) return null;
  const t = await getTranslations('identity.social');

  return (
    <div className={styles.socialBlock}>
      <div className={styles.socialDivider} aria-hidden="true">
        <span>{t('divider')}</span>
      </div>
      {outcome.value.providers.map((provider) => {
        const query = new URLSearchParams({ intent });
        if (returnTo) query.set('return', returnTo);
        return (
          <ProviderButton
            key={provider}
            href={`/auth/social/${provider}/start?${query.toString()}`}
            glyph={providerGlyph(provider)}
          >
            {t('continueWith', { provider: providerLabel(provider) })}
          </ProviderButton>
        );
      })}
    </div>
  );
}
