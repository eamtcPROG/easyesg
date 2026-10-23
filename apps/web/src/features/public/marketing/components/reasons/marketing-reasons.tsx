import { getTranslations } from 'next-intl/server';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './reasons.module.css';

/**
 * The three situations a visitor arrives in — S-29's *"for whom"*: someone asked for the data, the standard is hard to
 * read, the numbers are not all there. Beneath the hero's figure, on the same surface, as the artboard sets them.
 *
 * **Each reason's title is an `<h2>`**: the band has no heading of its own, and three short sections under the page's
 * `<h1>` are what a reader navigating by heading meets here.
 */
const REASONS = ['bank', 'standard', 'numbers'] as const;

export async function MarketingReasons() {
  const t = await getTranslations(`${MARKETING_MESSAGES}.reasons`);

  return (
    <div className={styles.band}>
      <ul className={styles.reasons}>
        {REASONS.map((reason) => (
          <li key={reason} className={styles.reason}>
            <h2 className={`t-heading-3 ${styles.title}`}>{t(`${reason}.title`)}</h2>
            <p className={`t-body ${styles.body}`}>{t(`${reason}.body`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
