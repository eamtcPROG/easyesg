'use client';

import { StatusChip, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import { PERIOD_STANDING_TONE } from '@/features/periods/tools/periods';
import { entityPeriodsRoute, periodRoute } from '@/lib/routes';
import { GuardedLink } from '@/shared/leave-guard';
import { PERIODS_NAMED, newestPeriods, type EntityPeriod } from '../../tools/entity-periods';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * The record's side column — *Periods on this entity*, as the S-13 record artboard draws it above the archive panel,
 * and **the record's way into S-14** (`design_spec.md` §5, S-13's exits; amended 29 Sep 2026). Each year leads to its
 * period, and the link beneath to the entity's whole list, which is where a period is opened.
 *
 * **Drawn for every stored entity, archived included**: an archived entity's periods and filed reports survive it
 * (FR-20), so they stay one press away. **Its links ask before leaving unsaved changes**, as the arrow and the
 * breadcrumb do (`shared/leave-guard.tsx`) — a press inside the record should not cost the record's edits.
 *
 * `periods` is null when they could not be read, and the panel says so rather than claiming there are none; its link
 * still leads to the list either way.
 */
export function EntityPeriodsPanel({
  entityId,
  periods,
}: {
  readonly entityId: string;
  readonly periods: readonly EntityPeriod[] | null;
}) {
  const t = useTranslations(`${ENTITIES_MESSAGES}.periods`);
  const tPeriods = useTranslations(PERIODS_MESSAGES);
  const headingId = useId();

  const { named, more } = newestPeriods({ periods: periods ?? [], named: PERIODS_NAMED.PANEL });

  return (
    <section className={styles.sidePanel} aria-labelledby={headingId}>
      <h2 id={headingId} className={`t-heading-3 ${styles.sidePanelTitle}`}>
        {t('panelTitle')}
      </h2>

      {periods === null ? <p className={`t-body ${styles.sidePanelBody}`}>{t('unavailable')}</p> : null}
      {periods?.length === 0 ? <p className={`t-body ${styles.sidePanelBody}`}>{t('panelNone')}</p> : null}

      {named.length > 0 ? (
        <ul className={styles.periodList}>
          {named.map((period) => (
            <li key={period.id} className={styles.periodItem}>
              <TextLink asChild>
                <GuardedLink href={periodRoute({ entityId, periodId: period.id })}>
                  <span className="t-numeric">{period.fiscalYear}</span>
                </GuardedLink>
              </TextLink>
              <StatusChip tone={PERIOD_STANDING_TONE[period.standing]}>
                {tPeriods(`standing.${period.standing}`)}
              </StatusChip>
            </li>
          ))}
        </ul>
      ) : null}
      {more > 0 ? <p className={`t-caption ${styles.sub}`}>{t('more', { count: more })}</p> : null}

      {/* Named as S-14 names itself, so the link says where it lands — the breadcrumb's rule for its step back. */}
      <TextLink asChild>
        <GuardedLink href={entityPeriodsRoute(entityId)}>{tPeriods('title')}</GuardedLink>
      </TextLink>
    </section>
  );
}
