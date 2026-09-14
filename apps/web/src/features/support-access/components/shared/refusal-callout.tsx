import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * A refused answer or end, as the API worded it (task 67.9; NFR-79) — shared by the banner's two control sets.
 * `action` is the notice's, which is `null` for every server-composed refusal: the next step is in the detail.
 */
export function RefusalCallout({ notice }: { readonly notice: Notice }) {
  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
