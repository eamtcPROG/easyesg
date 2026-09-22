import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * A refused mark or dismissal, as the API worded it (task 50.2.1; NFR-79) — shared by the heading's *mark all* and
 * each notice's controls. `action` is the notice's, which is `null` for every server-composed refusal.
 */
export function CentreActionRefusal({ notice }: { readonly notice: Notice }) {
  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
