import type { LegalControllerRecord } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'use-intl';

/**
 * A-21's change attribution (task 75) — §4.6's Record element: who last changed the operator's details, and when; or
 * that the values in force are the platform's starting ones, which no operator published; or that none is published,
 * in which case the documents naming the operator are not served (§12.5.6's task-75 row (7)).
 */
export function LegalControllerAttribution({ record }: { readonly record: LegalControllerRecord }) {
  const t = useTranslations('platform.legalController.attribution');
  const format = useFormatter();

  return (
    <dl className="t-body grid grid-cols-1 gap-y-[var(--space-1)] sm:grid-cols-[auto_1fr] sm:gap-x-[var(--space-4)]">
      <dt className="text-[var(--text-muted)]">{t('label')}</dt>
      <dd>
        {record.revision === 0 || record.changedAt === null
          ? t('never')
          : record.changedByEmail === null
            ? t('seeded')
            : t('by', { email: record.changedByEmail, time: format.dateTime(record.changedAt, 'stamp') })}
      </dd>
    </dl>
  );
}
