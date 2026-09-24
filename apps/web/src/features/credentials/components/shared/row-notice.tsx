'use client';

import { Callout } from '@easyesg/ui';
import { stageSection, type CredentialsSection } from '../../tools/credentials-state';
import { useCredentials } from './credentials-context';

/**
 * What the last action said, **inside the row it was said about** (task 169). A refusal keeps its row open, so it is
 * read beside the form it refused rather than at the head of a record the reader has scrolled away from; the codes'
 * introduction reads above the codes for the same reason. At rest the record's head says it — `notice/`.
 *
 * **In `components/shared/` on one test: more than one sibling reads it** — `password/`, `factor/` and `providers/`.
 */
export function RowNotice({ section }: { readonly section: CredentialsSection }) {
  const { notice, stage } = useCredentials();
  if (!notice || stageSection(stage) !== section) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
