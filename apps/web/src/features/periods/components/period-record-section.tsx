import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readPeriodRecord } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { PeriodRecordForm } from './period-record-form';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's record for one period (UC-56 … UC-58; cut out of the route by task 137, `shell-composes-only`): the read, and
 * which of §8.1's arms applies — refused, unreachable, or the record with its entity named above it.
 *
 * **The reopenings are read with the period rather than behind a disclosure**: UX-72 requires an amendment to look
 * like an amendment, and one that has to be opened to be seen is one a reader can miss. The read-only state is the
 * form's, because it is the form's controls that stop taking input.
 */
export async function PeriodRecordSection({
  entityId,
  periodId,
}: {
  readonly entityId: string;
  readonly periodId: string;
}) {
  const [read, t] = await Promise.all([readPeriodRecord({ entityId, periodId }), getTranslations(PERIODS_MESSAGES)]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('error.unreachable.title')} action={t('error.unreachable.action')}>
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  return (
    <div className={styles.record}>
      <p className="t-caption">{read.entity.name}</p>
      <PeriodRecordForm entityId={entityId} period={read.period} reopenings={read.reopenings} />
    </div>
  );
}
