'use client';

import type { NotificationItem as Notice } from '@easyesg/contracts';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { NOTICE_MESSAGES } from '../../../../shared/components/notice-messages';
import { NotificationItem } from '../../../../shared/components/notification-item';
import { receivedLabel } from '../../../../shared/tools/received-label';
import { PANEL_MESSAGES } from '../../shared/panel-messages';
import styles from '../../styles/panel.module.css';

/**
 * The panel's notices, newest first, through the same Notification item as S-26 (task 50.2.2; UX-63) — **with no
 * controls of their own**, as the artboard draws them: opening one marks it read, and *mark all* is the header's.
 *
 * **Its times are worded here, in the browser** — the panel's list is never server-rendered, so no server and browser
 * can disagree over *today*, and the formatter carries the configured timezone (§12.5.6's task-50.2 row (5)).
 */
export function PanelList({ notices }: { readonly notices: readonly Notice[] }) {
  const t = useTranslations(PANEL_MESSAGES);
  const tNotice = useTranslations(NOTICE_MESSAGES);
  const format = useFormatter();
  const now = useNow();

  return (
    <ul className={styles.notices} aria-label={t('list')}>
      {notices.map((notice) => (
        <li key={notice.id} className={styles.row}>
          <NotificationItem
            notice={notice}
            received={receivedLabel({
              receivedAt: new Date(notice.receivedAt),
              now,
              format,
              today: (time) => tNotice('today', { time }),
            })}
          />
        </li>
      ))}
    </ul>
  );
}
