'use client';

import { Callout } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

/**
 * What the last save or archive did, at the head of the record (task 134, on S-15's precedent).
 *
 * It replaced three hand-written `Callout` blocks — a success, `status === Problem`, and
 * `status === Unreachable` — that restated the outcome-to-notice rule `@/lib/notice` already owns.
 * This screen was the fourth copy of that rule, spelled in JSX, and is now a caller. §11.5 confirms
 * a reader's own action with a **toast**; the inventory has none, so a `Callout` stands in, as it
 * does on S-15 and S-16.
 */
export function EntityNotice({ notice }: { readonly notice: Notice | null }) {
  if (notice === null) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
