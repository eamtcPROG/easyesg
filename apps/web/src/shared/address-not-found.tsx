import { getTranslations } from 'next-intl/server';
import { AddressNotice } from './address-notice';

/** `error — not found` — the address resolves to nothing. */
export async function AddressNotFound() {
  const t = await getTranslations('chrome.notFound');
  return (
    <AddressNotice
      title={t('title')}
      body={t('body')}
      actionHome={t('actionHome')}
      actionSignIn={t('actionSignIn')}
    />
  );
}
