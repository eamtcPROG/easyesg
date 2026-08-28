'use client';

import { Callout } from '@easyesg/ui';
import { useCredentials } from './credentials-context';

/**
 * What the last action did, at the head of the record.
 *
 * §11.5 says a toast confirms *the user's own* action and these are exactly that — but the
 * inventory has no toast yet, so a `Callout` stands in, as it does on S-16. Recorded as a
 * substitution rather than left to look like a choice: when the toast is added, both screens
 * become one line each.
 *
 * `action` arrives from the notice and is `null` on every refusal — the API's `detail` carries its
 * own "what now" (NFR-79), and the catalogue sentence that used to sit beneath it was a duplicate.
 */
export function CredentialsNotice() {
  const { notice } = useCredentials();
  if (!notice) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
