import { getTranslations } from 'next-intl/server';
import { AddressNotice } from './address-notice';
import { ProbedReturnLink } from './probed-return-link';

/**
 * `error — not found` — the address resolves to nothing.
 *
 * **Its way back is decided in the browser** (task 74.4): this renders inside `[locale]/not-found.tsx`, which every page
 * beneath it renders eagerly, so it may read nothing per request — `address-notice.tsx` says why.
 */
export async function AddressNotFound() {
  const t = await getTranslations('chrome.notFound');
  return (
    <AddressNotice
      title={t('title')}
      body={t('body')}
      action={<ProbedReturnLink actionHome={t('actionHome')} actionSignIn={t('actionSignIn')} />}
    />
  );
}
