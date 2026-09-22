'use client';

import { NotificationBell } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useUnreadCount } from '@/client/notifications/use-unread-count';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';

/**
 * The band's notification entry, wired (task 50.2.1; UX-62, FR-161) — `packages/ui`'s bell over this app's router
 * and the unread count's poll.
 *
 * **A Client Component because the count is polled in the browser**, on OQ-36's minute, and the band is a Server
 * Component that renders once per navigation. The first render draws the bell without a count, since the count is
 * not yet known; it arrives with the first answer rather than as a zero this tier cannot vouch for.
 *
 * **Leads to S-26 until task 50.2.2** makes it open the panel the commerce artboard draws (§12.5.6's task-50.2 row
 * (1)). It names itself current there, so the band says where the reader is.
 */
export function NotificationsCorner() {
  const t = useTranslations('chrome.notifications');
  const unread = useUnreadCount();
  const pathname = usePathname();

  return (
    <NotificationBell
      href={ROUTES.NOTIFICATIONS}
      label={unread === null ? t('label') : t('unreadLabel', { count: unread })}
      count={unread}
      current={pathname === ROUTES.NOTIFICATIONS}
      linkComponent={Link}
    />
  );
}
