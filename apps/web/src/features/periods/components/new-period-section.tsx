import { CALLOUT_INTENT, Callout, RecordShell, TextLink } from '@easyesg/ui';
import { ENTITY_STATUS } from '@easyesg/contracts';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { todayIn } from '@/lib/legal-date';
import { PERIODS_FROM_PARAM, readPeriodsFrom } from '@/lib/periods-from';
import { ROUTES, entityPeriodsRoute } from '@/lib/routes';
import { readNewPeriod } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { yearOfDay } from '../tools/period-fields';
import { ArchivedEntityNotice } from './archived-entity-notice';
import { PeriodRecordForm } from './period-record-form';
import { PeriodsBreadcrumb } from './periods-breadcrumb';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's record in its **create** mode (UC-56): the read, and which of §8.1's arms applies — refused, unreachable, or
 * the form under a trail that names its entity. `PeriodRecordSection`'s arms, for the same read's failures. The read is
 * the entity, for the trail, and the years its periods hold, for the year list (`readNewPeriod` says why).
 *
 * **An archived entity gets the statement in the form's place** (FR-20; §12.5.6's task-187 row): its list no longer
 * links here, but a bookmark or a stale tab still can, and a form the api would refuse with `entity-archived` is a
 * control that cannot act. Under the same trail, title and arrow, and with nothing to lose, so no leave question.
 */
export async function NewPeriodSection({
  entityId,
  searchParams,
}: {
  readonly entityId: string;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, read, t, timeZone] = await Promise.all([
    searchParams,
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

  const from = readPeriodsFrom(query[PERIODS_FROM_PARAM]);

  if (read.entity.status === ENTITY_STATUS.ARCHIVED) {
    const title = t('record.createTitle');
    return (
      <div className={styles.record}>
        <RecordShell
          breadcrumb={<PeriodsBreadcrumb entity={read.entity} record={title} from={from} linkComponent={Link} />}
          back={{ href: entityPeriodsRoute(read.entity.id, from), label: t('record.back') }}
          linkComponent={Link}
          title={title}
        >
          <ArchivedEntityNotice />
        </RecordShell>
      </div>
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
        // Where the reader came from, so the way back to the list still leads on to it (`periods-from.ts`).
        from={from}
      />
    </div>
  );
}
