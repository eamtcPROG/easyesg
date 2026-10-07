'use client';

import type { CalcSite } from '@easyesg/contracts';
import { ARIA_CURRENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { reportCalculatorRoute } from '@/lib/routes';
import type { LineView } from '../../tools/lines';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * *All sites · 4 lines*, then each site with its count (§4.7's site chips; the artboard's 8.2). **Links, not a toggle**,
 * as S-26's tabs are: each site shown is its own address (UX-4), so a colleague can be sent the site in question, and
 * the one shown says so with `aria-current`. Drawn only where there is more than one site to choose between.
 */
export function SiteChips({
  reportId,
  sites,
  lines,
  shown,
}: {
  readonly reportId: string;
  readonly sites: readonly CalcSite[];
  readonly lines: readonly LineView[];
  /** The site shown, or `null` for all. */
  readonly shown: number | null;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.sites`);
  if (sites.length < 2) return null;
  const chips = [
    { site: null, label: t('all', { count: lines.length }) },
    ...sites.map((site) => ({
      site: site.ordinal,
      label: t('one', {
        name: site.name ?? t('unnamed', { position: site.ordinal + 1 }),
        count: lines.filter((line) => line.siteOrdinal === site.ordinal).length,
      }),
    })),
  ];
  return (
    <ul className={styles.chips} aria-label={t('label')}>
      {chips.map((chip) => (
        <li key={chip.site ?? 'all'}>
          <Link
            className={styles.chip}
            href={reportCalculatorRoute({ reportId, site: chip.site })}
            aria-current={chip.site === shown ? ARIA_CURRENT.PAGE : undefined}
            scroll={false}
          >
            {chip.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
