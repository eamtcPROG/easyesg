import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { CENTRE_MESSAGES } from '@/features/notifications/centre/components/shared/centre-messages';
import styles from '@/features/notifications/centre/components/styles/centre.module.css';

/**
 * S-26's **loading — initial** (§8.1, UX-90) — and its wait on every tab and page, since those are navigations.
 *
 * **Skeletons, not a spinner** (UX-115): a list of notices has a known shape, so the wait draws it — the real heading
 * above three rows — and resolving it moves nothing. The rows are hidden from assistive technology and one status
 * line says what is being waited for instead.
 *
 * **No `activateRequestLocale` here**: Next passes `loading.tsx` no props, so the catalogue resolves through
 * `requestLocale` alone — correct only while `[locale]` is `force-dynamic`, S-16's recorded coupling.
 */
export default async function NotificationCentreLoading() {
  const t = await getTranslations(CENTRE_MESSAGES);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </div>
      </header>
      <p className={styles.assistive} role="status">
        {t('loading')}
      </p>
      <div className={styles.loadingRows}>
        <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
      </div>
    </div>
  );
}
