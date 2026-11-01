import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import styles from '@/features/periods/components/periods.module.css';

/**
 * S-14's create form — its **loading — initial** (§8.1, UX-90), since the section reads the entity its trail names
 * (30 Sep 2026). A record route under an index takes its own, or the index's would draw the list's heading over the
 * form. The heading is the real one; the trail and the arrow arrive with the read, as on S-14's other record. **No
 * `activateRequestLocale` here** — Next passes `loading.tsx` no props, correct only while `[locale]` declares
 * `force-dynamic`.
 */
export default async function NewReportingPeriodLoading() {
  const t = await getTranslations(PERIODS_MESSAGES);

  return (
    <div className={styles.record}>
      <h1 className="t-heading-1">{t('record.createTitle')}</h1>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('record.createLoading')}
        </p>
      </Panel>
    </div>
  );
}
