import type { NotificationItem as Notice } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import type { CentreView } from '../../tools/centre-view';
import { receivedLabel } from '../../tools/received-label';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import styles from '../styles/centre.module.css';
import { CentrePager } from './centre-pager';
import { NoticeControls } from './notice-controls';
import { NOTICE_MESSAGES } from './notice-messages';
import { NotificationItem } from './notification-item';

/**
 * S-26's list — one page of the recipient's notices, newest first, and the pager (task 50.2.1; UC-165 … UC-167).
 *
 * **A list, not the Index archetype's table.** §4.6's Index is *find one among many*, and S-26 is one, but its rows
 * are §11.5's Notification item — a title, a text, a link — which a table's cells would only cut apart. So it
 * composes the archetype's parts by hand, `IndexShell`'s rule between them included: the section chooses the empty
 * state from `total` and `matched`, exactly as the shell would, and this renders only a page that has rows.
 *
 * **Each notice's time is worded here, on the server**, because *today* depends on the clock (`received-label.ts`).
 */
export async function CentreList({
  page,
  view,
}: {
  readonly page: IndexPage<Notice>;
  readonly view: CentreView;
}) {
  const [t, tNotice, format, now] = await Promise.all([
    getTranslations(CENTRE_MESSAGES),
    getTranslations(NOTICE_MESSAGES),
    getFormatter(),
    getNow(),
  ]);

  return (
    <div className={styles.list}>
      <ul className={styles.notices} aria-label={t('list')}>
        {page.rows.map((notice) => (
          <li key={notice.id} className={styles.row}>
            <NotificationItem
              notice={notice}
              received={receivedLabel({
                receivedAt: new Date(notice.receivedAt),
                now,
                format,
                today: (time) => tNotice('today', { time }),
              })}
              controls={<NoticeControls notice={{ id: notice.id, readAt: notice.readAt }} />}
            />
          </li>
        ))}
      </ul>
      <CentrePager page={page.page} matched={page.matched} view={view} />
    </div>
  );
}
