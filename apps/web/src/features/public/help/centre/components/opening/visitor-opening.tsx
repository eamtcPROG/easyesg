import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import { HelpSearch, SEARCH_TONE } from './help-search';
import styles from './opening.module.css';

/**
 * S-32's opening for a visitor (task 227; artboard 02) — the public band run on into a pine field holding the promise
 * that nothing is behind an account, and the search. It takes the band's surface and its text pair, as S-29's hero
 * does, so a re-skin that moves the band moves both.
 */
export async function VisitorOpening({
  query,
  total,
  content,
  page,
}: {
  readonly query: string;
  readonly total: number;
  readonly content: Locale;
  readonly page: Locale;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <div className={styles.visitorBand}>
      <div className={styles.inner}>
        <div className={styles.visitorWords}>
          <p className={styles.visitorEyebrow}>{t('guest.eyebrow')}</p>
          <h1 className={`t-display ${styles.visitorTitle}`}>{t('guest.title')}</h1>
          <p className={`t-body ${styles.visitorLede}`}>{t('guest.lede')}</p>
        </div>
        <HelpSearch query={query} total={total} content={content} page={page} tone={SEARCH_TONE.BAND} />
      </div>
    </div>
  );
}
