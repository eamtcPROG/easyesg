'use client';

import type { NotificationItem as Notice } from '@easyesg/contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { markNoticeOpened } from '@/client/notifications/mark-notice-opened';
import { NOTIFICATIONS_QUERY_SCOPE } from '@/client/notifications/notifications-query-keys';
import { Link } from '@/i18n/navigation';

/**
 * A notice's link to what raised it, which records the notice read as the reader follows it (task 50.2.1; UC-166;
 * §12.5.6's task-50.2 row (2)).
 *
 * **A real link** (UX-63): it navigates before hydration, opens in a new tab and copies as an address, all of which
 * a button pretending to be a link would lose. The mark rides beside the navigation as a `keepalive` request
 * (`mark-notice-opened.ts` says why not a Server Action), is sent only for a notice still unread, and refreshes the
 * band's count and the panel's list once it has landed. A middle click opens it too, so it marks too.
 *
 * Before hydration the link still leads to the notice and marks nothing, which the reader can do from S-26.
 *
 * **In `shared/` on one test: is it read by more than one surface?** Its one importer is the Notification item, and
 * the item is drawn by S-26's list and the panel's — so it sits beside the item, where both reach it.
 *
 * **It takes the notice trimmed to what it reads**, since everything handed to a Client Component crosses the wire
 * (`server-serialization`): the item passes one such object to both its links, and Flight sends it once.
 */
export function OpenNoticeLink({
  notice,
  id,
  className,
  describedBy,
  children,
}: {
  readonly notice: Pick<Notice, 'id' | 'readAt' | 'deepLink'>;
  readonly id?: string;
  readonly className?: string;
  readonly describedBy?: string;
  readonly children: ReactNode;
}) {
  const client = useQueryClient();
  const opened = () => {
    if (notice.readAt !== null) return;
    markNoticeOpened({
      notificationId: notice.id,
      onSent: () => void client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_SCOPE }),
    });
  };

  return (
    <Link
      id={id}
      className={className}
      href={notice.deepLink}
      aria-describedby={describedBy}
      onClick={opened}
      onAuxClick={(event) => {
        if (event.button === 1) opened();
      }}
    >
      {children}
    </Link>
  );
}
