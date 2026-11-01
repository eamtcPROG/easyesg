import type { NotificationItem as Notice } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { noticeTitleId } from '../tools/notice-title-id';
import styles from './notification-item.module.css';
import { NOTICE_MESSAGES } from './notice-messages';
import { OpenNoticeLink } from './open-notice-link';

/**
 * §11.5's Notification item — *category, subject link, read state* — built in the tenant application, the only one
 * with a centre (task 50.2.1; UX-89 as amended 14 Sep 2026; UX-62 … UX-64).
 *
 * **Every notice is a link to what raised it** (UX-63, FR-162): its action words where the API sent them, *"Open
 * the findings"*, and otherwise its title. **Every part but the link may be absent**, since the API omits wording
 * nobody has written (§12.5.6's task-50.2 row (3)): no category chip without a name, no text without a body, and a
 * notice with no title is named by this app's own word for one rather than by nothing.
 *
 * **Read state is not colour alone** (UX-102): an unread notice carries the dot and a stronger title, and the word
 * *unread* for assistive technology.
 *
 * Directive-free on purpose: S-26's list renders it on the server and the panel (task 50.2.2) inside a Client
 * Component — both are legal for a component with no hook of the browser's.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's list and the panel.
 *
 * States (§8.1, the applicable subset): unread · read · parts absent. Its controls arrive as a slot, so S-26's list
 * offers *mark read* and *dismiss* where the panel, as its artboard draws it, offers none.
 */
export function NotificationItem({
  notice,
  received,
  controls,
}: {
  readonly notice: Notice;
  /** When it reached the reader, in words — decided on the server (`received-label.ts`). */
  readonly received: string;
  readonly controls?: ReactNode;
}) {
  const t = useTranslations(NOTICE_MESSAGES);
  const unread = notice.readAt === null;
  const title = notice.title ?? t('untitled');
  const titleId = noticeTitleId(notice.id);
  // What the two links read, and nothing else — one object, so the wire carries it once for both.
  const link = { id: notice.id, readAt: notice.readAt, deepLink: notice.deepLink };

  return (
    <div className={styles.notice} data-unread={unread ? '' : undefined}>
      <span className={styles.marker} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.top}>
          <p className={styles.heading}>
            {notice.actionLabel === undefined ? (
              <OpenNoticeLink id={titleId} className={styles.noticeTitle} notice={link}>
                {title}
              </OpenNoticeLink>
            ) : (
              <span id={titleId} className={styles.noticeTitle}>
                {title}
              </span>
            )}
            {unread ? <span className={styles.assistive}>{t('unread')}</span> : null}
            {notice.categoryName === undefined ? null : (
              <StatusChip tone={STATUS_TONE.NEUTRAL}>{notice.categoryName}</StatusChip>
            )}
          </p>
          <time className={styles.time} dateTime={new Date(notice.receivedAt).toISOString()}>
            {received}
          </time>
        </div>
        {notice.body === undefined ? null : <p className={`t-body ${styles.body}`}>{notice.body}</p>}
        {notice.actionLabel === undefined ? null : (
          <OpenNoticeLink className={styles.action} notice={link} describedBy={titleId}>
            {notice.actionLabel}
          </OpenNoticeLink>
        )}
        {controls === undefined ? null : <div className={styles.itemControls}>{controls}</div>}
      </div>
    </div>
  );
}
