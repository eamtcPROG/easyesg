'use client';

import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * What the last save did, at the head of a record — S-15's and S-13's, and any Record screen's.
 *
 * **In `src/shared/` because two features read it** (task 134's parent-close review found
 * `EntityNotice` a byte-for-byte copy of `ProfileNotice`, which is the drift shape this repository
 * has already paid for once). It takes a `Notice` and renders it; where the title and body come
 * from — the problem document member by member, the bundled fallback per missing member — is
 * `@/lib/notice`'s, and re-deciding it here is exactly the drift the extraction ended. S-16's
 * `AccessNotice` is not a third reader: it is region-gated on the board's own context.
 *
 * §8.3 (UX-67) confirms a reader's own action with a **toast**, which §11.5 enumerates and
 * `packages/ui` has not built, so a `Callout` stands in. Recorded as a substitution rather than left
 * to look like a choice.
 */
export function RecordNotice({ notice }: { readonly notice: Notice | null }) {
  if (notice === null) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
