import { getTranslations } from 'next-intl/server';
import { AddressNotice } from './address-notice';

/** `error — not yet available` — a real route whose screen has not shipped. */
export async function NotYetAvailable() {
  const t = await getTranslations('chrome.notYetAvailable');
  return (
    <AddressNotice
      title={t('title')}
      body={t('body')}
      actionHome={t('actionHome')}
      actionSignIn={t('actionSignIn')}
    />
  );
}
