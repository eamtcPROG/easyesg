'use client';

import { ExpiringCallout, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { stageSection, type CredentialsSection } from '../../tools/credentials-state';
import { useCredentials } from './credentials-context';

/**
 * What the last action said, **inside the row it was said about** (task 169). A refusal keeps its row open, so it is
 * read beside the form it refused rather than at the head of a record the reader has scrolled away from; the codes'
 * introduction reads above the codes for the same reason. At rest the record's head says it — `notice/`.
 *
 * **It leaves after a while, whatever it says** — the Expiring callout, `design_spec.md` §8.1 as amended 28 Sep 2026
 * by the project owner, as `CredentialsNotice` does; the codes below it stay, under their own heading.
 *
 * **In `components/shared/` on one test: more than one sibling reads it** — `password/`, `factor/` and `providers/`.
 */
export function RowNotice({ section }: { readonly section: CredentialsSection }) {
  const t = useTranslations('forms');
  const { notice, stage } = useCredentials();
  const [shown, dismiss] = useDismissible(stageSection(stage) === section ? notice : null);
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
