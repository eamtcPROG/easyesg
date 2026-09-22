'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { UNREAD_COUNT_QUERY_KEY } from '@/client/notifications/unread-count-key';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, type Notice } from '@/lib/notice';
import type { CentreActionResult } from '../../actions/action-results';
import { CENTRE_MESSAGES } from './centre-messages';

/**
 * One mark or dismissal, sent from S-26 (task 50.2.1) — the pending flag the control wears, the refusal it shows, and
 * the band's count told to catch up. Shared by the heading's *mark all* and each notice's controls, which is its
 * admission here.
 *
 * **No success value**, support access's reason: the action revalidates S-26, so the list is re-rendered from the
 * server as whatever is now true. **The count is invalidated whatever the answer**: after a success it is stale,
 * after a refusal it may be, and a poll a minute later would show the reader their own click landing late.
 */
export function useCentreAction() {
  const t = useTranslations(`${CENTRE_MESSAGES}.error.action`);
  const client = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Notice | null>(null);

  const run = (send: () => Promise<CentreActionResult>) => {
    setRefusal(null);
    startTransition(async () => {
      const outcome = await send();
      await client.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      if (outcome.status !== API_OUTCOME.Ok) {
        setRefusal(failureNotice({ outcome, unreachable: { title: t('title'), body: t('body') } }));
      }
    });
  };

  return { pending, refusal, run } as const;
}
