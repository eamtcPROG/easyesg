'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { LineView } from '../../tools/lines';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';

/**
 * *Calculator · 3 of 4*, *next source*, *back to all sources* — §4.7's *one source per screen with n of N at 390*
 * (task 39.2; the artboard's narrow frame), over the same `?line=` address that opens a derivation at every width. The
 * stylesheet draws it below the narrow frame only, where it is the way through the bills one at a time; wider, the
 * open line sits in its table and this has nothing to add.
 */
export function LinePager({
  lines,
  open,
  href,
}: {
  /** The lines shown, in their order. */
  readonly lines: readonly LineView[];
  readonly open: string | null;
  readonly href: (lineId: string | null) => string;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.pager`);
  const { sourceName } = useCalculatorWords();
  const at = lines.findIndex((line) => line.id === open);
  if (at < 0) return null;
  const next = lines[at + 1];
  return (
    <nav className={styles.pager} aria-label={t('label')}>
      <p className={styles.pagerPosition}>{t('position', { position: at + 1, total: lines.length })}</p>
      <div className={styles.pagerLinks}>
        {next === undefined ? null : (
          <Link className={styles.how} href={href(next.id)} scroll={false}>
            {t('next', { source: sourceName(next.sourceKey) })}
          </Link>
        )}
        <Link className={styles.how} href={href(null)} scroll={false}>
          {t('all')}
        </Link>
      </div>
    </nav>
  );
}
