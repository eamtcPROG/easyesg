import { getTranslations } from 'next-intl/server';
import styles from '../../shared/styles/identity-screens.module.css';
import { RequestResetForm } from './request-reset-form';

/**
 * S-02's reset-request region: the heading and the request form (`section-reads-parts-render`; the
 * page is a shell since task 157). It reads nothing but its own words — the form asks the API, and
 * its answer is uniform whether or not the address holds an account (NFR-64) — so this is the whole
 * of the screen the route used to draw itself.
 */
export async function RequestResetSection() {
  const t = await getTranslations('identity.resetRequest');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <RequestResetForm />
    </>
  );
}
