import { getFormatter, getTranslations } from 'next-intl/server';
import { calendarDay } from '@/lib/legal-date';
import { LEGAL_STANDING, type LegalDocument } from '@easyesg/i18n';
import styles from '../styles/legal.module.css';

/**
 * A document's standing (FR-205 AC-4, AC-10; 182/116), for the Content archetype's `standing` slot: the version in
 * force and the calendar day it applies from, both the release's. **In `shared/` because every document of the set
 * draws it.**
 */
export async function LegalStandingLine({ document }: { readonly document: LegalDocument }) {
  const [t, format] = await Promise.all([getTranslations('legal.standing'), getFormatter()]);
  const standing = LEGAL_STANDING[document];

  return (
    <p className={styles.standing}>
      <span>{t('version', { version: standing.version })}</span>
      <span>{t('effective', { date: format.dateTime(calendarDay(standing.effective), 'calendar') })}</span>
    </p>
  );
}
