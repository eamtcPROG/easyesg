import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import styles from '@/features/organization/components/access.module.css';

/**
 * S-16's **loading — initial** (§8.1, UX-90).
 *
 * The screen's whole body blocks on one read of two collections, so there is no shell worth
 * streaming ahead of it — `async-suspense-boundaries`' own test, answered the same way S-03
 * answered it. The heading and the lede are the real ones, so nothing shifts when the table
 * arrives; only the region below them is a wait.
 *
 * It also appears on every filter and sort, because those are navigations — which is why the copy
 * names the list rather than the page. A spinner labelled "loading" while a table the reader can
 * already see is being refiltered would say less than nothing.
 *
 * **No `activateRequestLocale` here**: Next passes `loading.tsx` no props, so messages resolve
 * through `requestLocale` alone. That is correct only while `[locale]` declares `force-dynamic` —
 * the same coupling S-03's loading state records, and the reason `apps/web/CLAUDE.md` names
 * `loading.tsx` as the first file to check when §14.2's caching decision is taken.
 */
export default async function UsersAndAccessLoading() {
  const t = await getTranslations('organization.access');

  return (
    <div className={styles.screen}>
      <header>
        <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </header>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </div>
  );
}
