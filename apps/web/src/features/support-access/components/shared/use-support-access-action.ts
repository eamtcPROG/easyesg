import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, type Notice } from '@/lib/notice';
import type { SupportAccessActionResult } from '../../actions/action-results';
import { SUPPORT_ACCESS_MESSAGES } from './support-access-messages';

/**
 * One answer or end, sent (task 67.9) — the pending flag the buttons wear, and the refusal they show. Shared by
 * the banner's two control sets, which is its admission here.
 *
 * **No success value at all**: the action revalidates the layout, so on success the banner holding these controls
 * is re-rendered from the server as whatever is now true, and a success notice would describe a banner that has
 * already changed. The refusal is one value — `null` until a send is refused, cleared when the next one starts.
 *
 * **The copy for an answer that never arrived is read here** (task 158). Both control sets showed the same words,
 * and each took them as a prop from its banner only to hand them straight to this hook.
 */
export function useSupportAccessAction() {
  const t = useTranslations(SUPPORT_ACCESS_MESSAGES);
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Notice | null>(null);

  const run = (send: () => Promise<SupportAccessActionResult>) => {
    setRefusal(null);
    startTransition(async () => {
      const outcome = await send();
      if (outcome.status !== API_OUTCOME.Ok) {
        setRefusal(
          failureNotice({
            outcome,
            unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
          }),
        );
      }
    });
  };

  return { pending, refusal, run } as const;
}
