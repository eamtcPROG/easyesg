import { BADGE_TONE, Badge } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import styles from '../styles/centre.module.css';
import { MarkAllControl } from './mark-all-control';
import { ReadStateTabs } from './read-state-tabs';

/**
 * S-26's heading, as the artboard draws it (task 50.2.1): the title with the unread count beside it, the lede, and
 * at the row's end the read-state tabs and *Mark all as read* (§12.5.6's task-50.2 rows (2), (4)).
 *
 * **The count and the controls need the read**, so on a refused or failed one the heading is the title and lede
 * alone — a count this screen could not read is not drawn as zero, and tabs over a list it could not load would
 * offer a choice with nothing behind it. *Mark all* is offered only while something is unread.
 */
export async function CentreHeading({ unread, view }: { readonly unread: number | null; readonly view: CentreView }) {
  const t = await getTranslations(CENTRE_MESSAGES);

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.titleRow}>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          {unread !== null && unread > 0 ? (
            <Badge tone={BADGE_TONE.ALERT} count={unread} label={t('unreadCount', { count: unread })} />
          ) : null}
        </div>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </div>
      {unread === null ? null : (
        <div className={styles.controls}>
          <ReadStateTabs view={view} unread={unread} />
          {unread > 0 ? <MarkAllControl /> : null}
        </div>
      )}
    </header>
  );
}
