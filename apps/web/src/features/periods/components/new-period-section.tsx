import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { todayIn } from '@/lib/legal-date';
import { ROUTES } from '@/lib/routes';
import { readNewPeriod } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { yearOfDay } from '../tools/period-fields';
import { PeriodRecordForm } from './period-record-form';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's record in its **create** mode (UC-56): the read, and which of §8.1's arms applies — refused, unreachable, or
 * the form under a trail that names its entity. `PeriodRecordSection`'s arms, for the same read's failures. The read is
 * the entity, for the trail, and the years its periods hold, for the year list (`readNewPeriod` says why).
 */
export async function NewPeriodSection({ entityId }: { readonly entityId: string }) {
  const [read, t, timeZone] = await Promise.all([
    readNewPeriod(entityId),
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
      {/* Chișinău's year, on the server — the configured zone (`i18n/request.ts`), never the browser's clock. */}
      <PeriodRecordForm
        entity={{ id: read.entity.id, name: read.entity.name }}
        reopenings={[]}
        currentYear={yearOfDay(todayIn(timeZone, new Date()))}
        takenYears={read.takenYears}
      />
    </div>
  );
}
