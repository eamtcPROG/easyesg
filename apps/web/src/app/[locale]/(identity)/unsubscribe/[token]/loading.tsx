import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { UNSUBSCRIBE_MESSAGES } from '@/features/identity/unsubscribe/components/shared/unsubscribe-messages';
import styles from '@/features/identity/shared/styles/identity-screens.module.css';

/**
 * S-38's **loading — initial** (§8.1, UX-90): the whole body waits on the link's read, as S-03's does, so the heading
 * renders and the Panel names the wait. S-03's loading state records why it cannot pin the locale; the same holds here.
 */
export default async function UnsubscribeLoading() {
  const t = await getTranslations(UNSUBSCRIBE_MESSAGES);

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
