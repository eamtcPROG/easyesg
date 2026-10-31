import { FOCUS_MEASURE, FocusColumn, SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from '../shared/help-centre.module.css';

/**
 * S-32's loading state (task 77; §8.1's `loading — initial`) — the boundary's fallback while the library is read: its
 * one landmark, a heading bar and two groups of article cards, so what resolves into them changes the words rather than
 * the page. Announced once as a status, since the bars say nothing to a screen reader. Beside the section it is paired
 * with, as `components-region-anatomy` places a fallback.
 */
export async function HelpCentreLoading() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      <div role="status" aria-label={t('loading')} className={styles.regions}>
        <Skeleton shape={SKELETON_SHAPE.HEADING} />
        <Skeleton />
        {[0, 1].map((group) => (
          <div key={group} className={styles.group}>
            <Skeleton shape={SKELETON_SHAPE.HEADING} />
            <ul className={styles.articles}>
              <li>
                <Skeleton shape={SKELETON_SHAPE.BLOCK} />
              </li>
              <li>
                <Skeleton shape={SKELETON_SHAPE.BLOCK} />
              </li>
            </ul>
          </div>
        ))}
      </div>
    </FocusColumn>
  );
}
