import { getTranslations } from 'next-intl/server';
import { legendStates, type StripModule } from '../../../tools/module-strip';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The strip's key, beneath it as the artboard draws one (task 255) — **only the states the strip shows**
 * (`legendStates`), and the ring where work stopped when there is one.
 *
 * **Hidden from assistive technology**, because it is a key to colours and every cell of the strip already names its
 * own state in words: read aloud, the legend would be a second list repeating what the first just said.
 */
export async function ResumeLegend({ strip }: { readonly strip: readonly StripModule[] }) {
  const [t, tState] = await Promise.all([
    getTranslations(`${OVERVIEW_MESSAGES}.resume`),
    getTranslations(`${OVERVIEW_MESSAGES}.resume.state`),
  ]);

  return (
    <ul className={`t-caption ${styles.legend}`} aria-hidden="true">
      {legendStates(strip).map((state) => (
        <li key={state} className={styles.legendItem}>
          <span className={styles.swatch} data-state={state} />
          {tState(state)}
        </li>
      ))}
      {strip.some((entry) => entry.current) ? (
        <li className={styles.legendItem}>
          <span className={styles.swatch} data-current />
          {t('stoppedHere')}
        </li>
      ) : null}
    </ul>
  );
}
