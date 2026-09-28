'use client';

import { ExpiringCallout, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Notice } from '@/lib/notice';

/**
 * What the reader's last submit was answered with, as a `Notice` — a Record's save at its head (S-13, S-14, S-15,
 * S-27), and the one press of a screen that is not a Record: S-38's switch, S-37's choice, a notification's mark and
 * the support-access banner's answers.
 *
 * **In `src/shared/` because several features read it**, and the readers it has are copies it replaced: task 134's
 * parent-close review found `EntityNotice` a byte-for-byte copy of `ProfileNotice`, and on 28 Sep 2026
 * `NoticeActionRefusal` and support access's `RefusalCallout` were two more. It takes a `Notice` and renders it;
 * where the title and body come from — the problem document member by member, the bundled fallback per missing
 * member — is `@/lib/notice`'s, and re-deciding it here is exactly the drift the extraction ended. S-16's
 * `AccessNotice` and S-28's two notices are not readers: each is gated on its own board's context.
 *
 * **It leaves after a while, whatever it says** (`design_spec.md` §8.1, amended 28 Sep 2026 by the project owner): the
 * Expiring callout, with `useDismissible` to stop rendering the one the reader closed or outlasted. **So a caller hands
 * the same object for the same outcome** — one held in state, or built once per outcome — since a notice rebuilt on
 * every render is a new one each time, and a closed message would come straight back.
 */
export function RecordNotice({ notice }: { readonly notice: Notice | null }) {
  const t = useTranslations('forms');
  const [shown, dismiss] = useDismissible(notice);
  if (shown === null) return null;

  return (
    <ExpiringCallout
      intent={shown.intent}
      title={shown.title}
      action={shown.action}
      dismissLabel={t('closeMessage')}
      onDismiss={dismiss}
    >
      {shown.body}
    </ExpiringCallout>
  );
}
