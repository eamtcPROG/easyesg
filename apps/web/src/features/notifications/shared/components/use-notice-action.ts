'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { NOTIFICATIONS_QUERY_SCOPE } from '@/client/notifications/notifications-query-keys';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, type Notice } from '@/lib/notice';
import type { NoticeActionResult } from '../actions/action-results';
import { NOTICE_ACTION_MESSAGES } from './notice-messages';

/**
 * One mark or dismissal, sent (task 50.2.1) — the pending flag the control wears, the refusal it shows, and every
 * notification query told to catch up.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's *mark all* and each notice's controls,
 * and the panel's *mark all* (task 50.2.2).
 *
 * **No success value**, support access's reason: the action revalidates S-26, so the page is re-rendered from the
 * server as whatever is now true. **The queries are invalidated whatever the answer** — the band's count and the
 * panel's list, one scope — because after a success they are stale, after a refusal they may be, and a poll a minute
 * later would show the reader their own click landing late.
 */
export function useNoticeAction() {
  const t = useTranslations(NOTICE_ACTION_MESSAGES);
  const client = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Notice | null>(null);

  const run = (send: () => Promise<NoticeActionResult>) => {
    setRefusal(null);
    startTransition(async () => {
      const outcome = await send();
      await client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_SCOPE });
      if (outcome.status !== API_OUTCOME.Ok) {
        setRefusal(failureNotice({ outcome, unreachable: { title: t('title'), body: t('body') } }));
      }
    });
  };

  return { pending, refusal, run } as const;
}
