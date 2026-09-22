'use client';

import { Button, type ButtonVariant } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { markAllNotificationsReadAction } from '../actions/actions';
import { NoticeActionRefusal } from './notice-action-refusal';
import { NOTICE_LIST_MESSAGES } from './notice-messages';
import { useNoticeAction } from './use-notice-action';
import styles from './notice-mark-all.module.css';

/**
 * *Mark all as read* (tasks 50.2.1, 50.2.2; §12.5.6's task-50.2 row (2)) — every notice the unread count counts, for
 * this reader alone, and its refusal beneath it when there is one.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's heading and the panel's header. The two
 * differ in emphasis alone — a secondary button in the page's heading row, a subtle one among the panel's header
 * controls — which is the `variant` each passes, not a second anatomy.
 *
 * **No confirmation**: marking read takes nothing away — each notice stays in the centre under *All*, with the time
 * it was marked — and a question before an action that loses nothing is a question for nothing. Every notification
 * query is invalidated after it (`use-notice-action.ts`), so the band's count and the panel's list redraw at once.
 */
export function NoticeMarkAll({ variant }: { readonly variant: ButtonVariant }) {
  const t = useTranslations(NOTICE_LIST_MESSAGES);
  const { pending, refusal, run } = useNoticeAction();

  return (
    <div className={styles.markAll}>
      <Button type="button" variant={variant} busy={pending} onClick={() => run(() => markAllNotificationsReadAction())}>
        {t('markAll')}
      </Button>
      {refusal === null ? null : <NoticeActionRefusal notice={refusal} />}
    </div>
  );
}
