import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { todayIn } from '@/lib/legal-date';
import { PERIODS_FROM_PARAM, readPeriodsFrom } from '@/lib/periods-from';
import { ROUTES } from '@/lib/routes';
import { readPeriodRecord } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { yearOfDay } from '../tools/period-fields';
import { PeriodRecordForm } from './period-record-form';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's record for one period (UC-56 … UC-58; cut out of the route by task 137, `shell-composes-only`): the read, and
 * which of §8.1's arms applies — refused, unreachable, or the record, its entity named in the trail above it.
 *
 * **The reopenings are read with the period rather than behind a disclosure**: UX-72 requires an amendment to look
 * like an amendment, and one that has to be opened to be seen is one a reader can miss. The read-only state is the
 * form's, because it is the form's controls that stop taking input.
 */
export async function PeriodRecordSection({
  entityId,
  periodId,
  searchParams,
}: {
  readonly entityId: string;
  readonly periodId: string;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, read, t, timeZone] = await Promise.all([
    searchParams,
    readPeriodRecord({ entityId, periodId }),
    getTranslations(PERIODS_MESSAGES),
    getTimeZone(),
  ]);

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
      <PeriodRecordForm
        entity={{ id: read.entity.id, name: read.entity.name }}
        period={read.period}
        reopenings={read.reopenings}
        currentYear={yearOfDay(todayIn(timeZone, new Date()))}
        takenYears={read.takenYears}
        // Where the reader came from, so the way back to the list still leads on to it (`periods-from.ts`).
        from={readPeriodsFrom(query[PERIODS_FROM_PARAM])}
      />
    </div>
  );
}
