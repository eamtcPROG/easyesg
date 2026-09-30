'use client';

import { Button, Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { newPeriodRoute } from '@/lib/routes';
import { PERIOD_STANDING_FILTERS, type PeriodView } from '../tools/periods';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * The Index's filter row (§4.6): the standing facet, and *open a period* at the row's end — S-13's row, taken by S-14
 * with S-13's other conventions (project owner, 30 Sep 2026), where the action had stood at the heading's end. The
 * action sits with the list it adds to, and only once the list has been read: a refused or failed read draws neither.
 *
 * **A link, not a button**: the create form is an address of its own (UX-4), so the action is a navigation.
 */
export function PeriodsToolbar({
  entityId,
  standing,
  onStandingChangeAction,
}: {
  readonly entityId: string;
  readonly standing: PeriodView['standing'];
  readonly onStandingChangeAction: (standing: PeriodView['standing']) => void;
}) {
  const t = useTranslations(PERIODS_MESSAGES);

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <Select
          label={t('filter.standing')}
          value={standing}
          onValueChange={(next) => onStandingChangeAction(next as PeriodView['standing'])}
          options={PERIOD_STANDING_FILTERS.map((option) => ({
            value: option,
            label: t(`filter.options.${option}`),
          }))}
        />
      </div>
      <Button asChild className={styles.toolbarButton}>
        <Link href={newPeriodRoute(entityId)}>{t('open')}</Link>
      </Button>
    </div>
  );
}
