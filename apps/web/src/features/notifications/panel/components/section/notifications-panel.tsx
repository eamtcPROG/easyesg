'use client';

import { NotificationBell } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Popover } from 'radix-ui';
import { useId, useState } from 'react';
import { useUnreadCount } from '@/client/notifications/use-unread-count';
import { NOTICE_ENTRY_MESSAGES } from '../../../shared/components/notice-messages';
import styles from '../styles/panel.module.css';
import { PanelContent } from './panel-content';

/**
 * The global tier's notification panel — the band's bell, and what it opens (task 50.2.2; UX-62; §12.5.6's task-50.2
 * row (1)). The commerce artboard's frame: a header with the count, *mark all* and a close; the two views; the latest
 * notices; and the way to S-26.
 *
 * **A Radix Popover rather than a hand-rolled panel**, for what a floating panel gets wrong on its own — focus moving
 * in and back to the bell, Escape, a click outside, and the dialog's name — and the bell is its trigger, which
 * `NotificationBell` takes through `asChild` by spreading what it is handed.
 *
 * **Its view is the content's own state**, not the address — a floating panel is not a place a reader returns to
 * (§12.5.6's row, implementation notes) — and lives in `panel-content.tsx`, so it starts again on every opening.
 * **It closes when a link in it is followed** — a notice, or *All notifications* — since the navigation changes the
 * page beneath and nothing would unmount it. One listener on the content, delegated: it asks whether the click landed
 * inside an anchor, so no link in the list needs a handler of its own.
 *
 * **`organizationId` keys its reads to the organization the band was rendered for**, so a switch starts it on the new
 * organization's centre rather than the one left (`notifications-query-keys.ts`).
 *
 * States (§8.1, the applicable subset): closed · open, with the notices' own arms inside (`notices/`).
 */
export function NotificationsPanel({ organizationId }: { readonly organizationId: string }) {
  const t = useTranslations(NOTICE_ENTRY_MESSAGES);
  const unread = useUnreadCount(organizationId);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <NotificationBell label={unread === null ? t('label') : t('unreadLabel', { count: unread })} count={unread} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.panel}
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby={titleId}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          <PanelContent organizationId={organizationId} titleId={titleId} unread={unread} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
