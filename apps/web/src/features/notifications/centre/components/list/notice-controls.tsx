'use client';

import type { NotificationItem as Notice } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { dismissNotificationAction, markNotificationReadAction } from '../../../shared/actions/actions';
import { NoticeActionRefusal } from '../../../shared/components/notice-action-refusal';
import { useNoticeAction } from '../../../shared/components/use-notice-action';
import { noticeTitleId } from '../../../shared/tools/notice-title-id';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * One notice's two controls on S-26 (task 50.2.1; UC-167; §12.5.6's task-50.1 row (9)): *mark as read* while it is
 * unread, and *dismiss*, which takes it out of the centre and records no reading. Each is described by the notice's
 * own title, so a screen reader moving by buttons hears which notice it is on.
 *
 * **One pending flag for both**: while either is on its way neither can be pressed, since its answer is what decides
 * whether the other still applies. **It takes the notice trimmed to what it reads**, since what a Client Component is
 * handed crosses the wire (`server-serialization`).
 */
export function NoticeControls({ notice }: { readonly notice: Pick<Notice, 'id' | 'readAt'> }) {
  const t = useTranslations(CENTRE_MESSAGES);
  const { pending, refusal, run } = useNoticeAction();
  const notificationId = notice.id;
  const describedBy = noticeTitleId(notice.id);

  return (
    <>
      {notice.readAt === null ? (
        <Button
          type="button"
          variant={BUTTON_VARIANT.SUBTLE}
          busy={pending}
          aria-describedby={describedBy}
          onClick={() => run(() => markNotificationReadAction({ notificationId }))}
        >
          {t('markRead')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant={BUTTON_VARIANT.SUBTLE}
        busy={pending}
        aria-describedby={describedBy}
        onClick={() => run(() => dismissNotificationAction({ notificationId }))}
      >
        {t('dismiss')}
      </Button>
      {refusal === null ? null : <NoticeActionRefusal notice={refusal} />}
    </>
  );
}
