'use client';

import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * What the last save did, at the head of the record (task 129).
 *
 * **This file is why the split was worth more than tidiness.** It replaced three hand-written
 * `Callout` blocks — a success, `status === Problem`, and `status === Unreachable` — which between
 * them restated the outcome-to-notice rule `@/lib/notice` already owns. That module exists because
 * S-16 and S-28 had *two* copies of it and they had drifted: S-28 put *"Încercați din nou."* under a
 * refusal whose `detail` ends with that very sentence, so a throttled reader was told to try again
 * beneath "wait a few minutes". This screen was a third copy, spelled in JSX instead of in a union,
 * and is now a caller.
 *
 * **The component takes a `Notice` and renders it.** Where the title and body come from — the
 * problem document member by member, the bundled fallback per missing member — is
 * `failureNotice`'s, and re-deciding it here is exactly the drift the extraction ended.
 *
 * §11.5 confirms a reader's own action with a **toast**; the inventory has none, so a `Callout`
 * stands in, as it does on S-16. Recorded as a substitution rather than left to look like a choice.
 */
export function ProfileNotice({ notice }: { readonly notice: Notice | null }) {
  if (notice === null) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
