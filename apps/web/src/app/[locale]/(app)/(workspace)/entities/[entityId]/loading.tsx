import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { ENTITY_RECORD_MESSAGES } from '@/features/entities/components/shared/entity-messages';
import styles from '@/features/entities/components/styles/entities.module.css';

/**
 * S-13's record, in its edit mode — its **loading — initial** (§8.1, UX-90; task 137), on S-16's precedent: the whole body waits
 * on the section's read, so a route-level boundary is the one there is. It stands where the entities index's loading
 * state used to, which drew the list's heading over a record. **No `activateRequestLocale` here** — Next passes
 * `loading.tsx` no props, so messages resolve through `requestLocale` alone, correct only while `[locale]` declares
 * `force-dynamic`.
 */
export default async function EntityRecordLoading() {
  const t = await getTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <div className={styles.screen}>
      <h1 className="t-heading-1">{t('title')}</h1>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </div>
  );
}
