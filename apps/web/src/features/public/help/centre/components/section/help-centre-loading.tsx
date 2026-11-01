import { MAIN_CONTENT_ID, SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './help-centre-loading.module.css';

/**
 * S-32's loading state (tasks 77, 227; §8.1's `loading — initial`) — the boundary's fallback while the library is
 * read, in the artboards' shape: the opening's heading and search, the topic cards, and the right-hand column's card,
 * so what resolves into them changes the words rather than the page. Announced once as a status, since the bars say
 * nothing to a screen reader; inside the screen's one landmark, which the section draws once it has read. Beside the
 * section it is paired with, as `components-region-anatomy` places a fallback.
 */
export async function HelpCentreLoading() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={pageStyles.page}>
      <div role="status" aria-label={t('loading')} className={styles.status}>
        <div className={styles.opening}>
          <div className={`${pageStyles.inner} ${styles.stack}`}>
            <Skeleton shape={SKELETON_SHAPE.HEADING} />
            <Skeleton />
            <Skeleton shape={SKELETON_SHAPE.BLOCK} />
          </div>
        </div>
        <div className={`${pageStyles.columns} ${pageStyles.inner}`}>
          <div className={styles.cards}>
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <Skeleton key={card} shape={SKELETON_SHAPE.BLOCK} />
            ))}
          </div>
          <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        </div>
      </div>
    </main>
  );
}
