import { Panel, Spinner } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import styles from '../styles/profile.module.css';

/**
 * S-27's **loading — initial** (§8.1, UX-90): the fallback of the page's `Suspense` around the section, which reads both
 * resources before it can draw anything. **A boundary in the page rather than a `loading.tsx`** — one at `/account`
 * would also wrap S-28 beneath it and draw this heading while credentials load (task 52's close review). The heading is
 * the real one, so nothing shifts when the record arrives.
 */
export async function ProfileLoading() {
  const t = await getTranslations(PROFILE_MESSAGES);

  return (
    <div className={styles.screen}>
      <hgroup>
        <h1 className="t-heading-1">{t('title')}</h1>
        <p className="t-body">{t('lede')}</p>
      </hgroup>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </div>
  );
}
