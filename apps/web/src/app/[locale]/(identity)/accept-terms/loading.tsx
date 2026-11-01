import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import styles from '@/features/identity/shared/styles/identity-screens.module.css';
import { ACCEPTANCE_MESSAGES } from '@/features/identity/acceptance/components/shared/acceptance-messages';

/**
 * S-43's **loading — initial** (§8.1, UX-90), S-36's shape: the whole body waits on one read — what the account owes —
 * so there is no shell worth streaming ahead of it, and a `loading.tsx` is what stops the browser sitting on the
 * previous page for the round trip. It cannot pin the locale, for S-36's loading state's reason.
 */
export default async function AcceptTermsLoading() {
  const t = await getTranslations(ACCEPTANCE_MESSAGES);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <Panel className={styles.formPanel}>
        <p className={styles.bodyText} role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </>
  );
}
