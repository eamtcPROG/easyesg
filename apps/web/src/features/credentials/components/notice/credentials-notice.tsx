'use client';

import { Callout } from '@easyesg/ui';
import { CREDENTIALS_STAGE } from '../../tools/credentials-state';
import { useCredentials } from '../shared/credentials-context';

/**
 * What the last action did, at the head of the record — **once every row is at rest** (task 169). A success closes its
 * row, so the head is where it is read; a refusal keeps its row open and is read there instead (`RowNotice`).
 *
 * §11.5 says a toast confirms *the user's own* action and these are exactly that — but the inventory has no toast yet,
 * so a `Callout` stands in, as it does on S-16. When the toast is added, both screens become one line each.
 */
export function CredentialsNotice() {
  const { notice, stage } = useCredentials();
  if (!notice || stage.kind !== CREDENTIALS_STAGE.IDLE) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
