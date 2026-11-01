import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import styles from '@/features/periods/components/periods.module.css';

/**
 * S-14's record — its **loading — initial** (§8.1, UX-90; task 137), on S-16's precedent: the whole body waits on the
 * section's read. It stands where the periods index's loading state used to, which drew the list's heading over one
 * period. The year is the read's, so the heading here is the screen's name. **No `activateRequestLocale` here** — Next
 * passes `loading.tsx` no props, correct only while `[locale]` declares `force-dynamic`.
 */
export default async function ReportingPeriodRecordLoading() {
  const t = await getTranslations(PERIODS_MESSAGES);

  return (
    <div className={styles.record}>
      <h1 className="t-heading-1">{t('title')}</h1>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('record.loading')}
        </p>
      </Panel>
    </div>
  );
}
