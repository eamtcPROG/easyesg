'use client';

import { ARIA_CURRENT, BADGE_TONE, Badge } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useUnreadCount } from '@/client/notifications/use-unread-count';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { NOTICE_ENTRY_MESSAGES } from '../../shared/components/notice-messages';
import styles from './notifications-entry.module.css';

/**
 * The compact drawer's *Notifications* row (task 50.2.1) — the workspace-tier specimen's *"Notifications 3"*, below
 * the rule with the global tier's other entries. The compact bar keeps its bell, which opens the panel; this row
 * is the drawer's way to the full page, as the specimen draws both.
 *
 * **The same count as the band's bell**, from the same query, so the two cannot disagree at the one width where
 * both are drawn. The row's name carries the count in words; the badge beside the word is drawn and hidden, so the
 * number is not read twice.
 *
 * `className` is the drawer's own row style, which the row takes rather than restates — it is one of the panel's
 * rows, and the panel decides what a row looks like.
 */
export function NotificationsEntry({
  organizationId,
  className,
}: {
  readonly organizationId: string;
  readonly className?: string;
}) {
  const t = useTranslations(NOTICE_ENTRY_MESSAGES);
  const unread = useUnreadCount(organizationId);
  const pathname = usePathname();

  return (
    <Link
      className={[className, styles.entry].filter(Boolean).join(' ')}
      href={ROUTES.NOTIFICATIONS}
      aria-label={unread === null ? undefined : t('unreadLabel', { count: unread })}
      aria-current={pathname === ROUTES.NOTIFICATIONS ? ARIA_CURRENT.PAGE : undefined}
    >
      {t('label')}
      {unread !== null && unread > 0 ? <Badge tone={BADGE_TONE.QUIET} count={unread} /> : null}
    </Link>
  );
}
