import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * A refused mark or dismissal, as the API worded it (task 50.2.1; NFR-79). `action` is the notice's, which is `null`
 * for every server-composed refusal.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's *mark all* and each notice's controls,
 * and the panel's *mark all* (task 50.2.2).
 */
export function NoticeActionRefusal({ notice }: { readonly notice: Notice }) {
  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
