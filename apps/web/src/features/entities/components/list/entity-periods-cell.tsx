'use client';

import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import { Link } from '@/i18n/navigation';
import { entityPeriodsRoute } from '@/lib/routes';
import type { EntityRow } from '../../tools/entities';
import { PERIODS_NAMED, newestPeriods } from '../../tools/entity-periods';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';

/**
 * The list's periods column — each entity's newest years and their standing, as the index artboard draws them
 * (*"2026 open · 2025 locked"*), and **the list's way into S-14** for that entity (`design_spec.md` §5, S-13's exits;
 * the column was deferred to task 31 and never picked up when that task closed, which left S-14 with no way in).
 *
 * **The whole summary is one link**, in every arm: an entity with no periods is the one whose reader most needs S-14,
 * since that is where its first period is opened, and one whose periods could not be read still has a list to go to —
 * so that arm names the destination rather than claiming there are none. The standing words are S-14's own, so a year
 * reads the same on both screens. Named for its row, as the row's action is: the visible words, then the entity.
 */
export function EntityPeriodsCell({ row }: { readonly row: EntityRow }) {
  const t = useTranslations(`${ENTITIES_MESSAGES}.periods`);
  const tPeriods = useTranslations(PERIODS_MESSAGES);

  let summary: string;
  if (row.periods === null) {
    summary = tPeriods('title');
  } else if (row.periods.length === 0) {
    summary = t('none');
  } else {
    const { named, more } = newestPeriods({ periods: row.periods, named: PERIODS_NAMED.COLUMN });
    // A year is passed as a string, as S-14's own title does: ICU would group a number ("2 026").
    const entries = named.map((period) =>
      t('entry', { year: String(period.fiscalYear), standing: tPeriods(`standing.${period.standing}`) }),
    );
    summary = [...entries, ...(more > 0 ? [t('more', { count: more })] : [])].join(' · ');
  }

  return (
    <TextLink asChild>
      <Link href={entityPeriodsRoute(row.id)} aria-label={t('named', { summary, name: row.name })}>
        {summary}
      </Link>
    </TextLink>
  );
}
