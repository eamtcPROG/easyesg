import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { PERIODS_MESSAGES } from './periods-messages';

/**
 * Why S-14 offers no new period: the entity is archived (FR-20; UX-13; §12.5.6's task-187 row).
 *
 * **Said once, where the action would have been asked for**: under the list's heading, where *open a period* no longer
 * stands in the filter row or in the first-use empty state, and in the create address's form's place. A removed action
 * that nothing explains is the indistinguishable read-only state UX-13 forbids. **Its own file because both sections
 * draw it**, the list's and the create form's, and one sentence in two copies is how the two would come to disagree.
 *
 * `action={null}`: there is no step that reopens an archived entity — FR-20 has no un-archive — and the body already
 * says that its periods and reports stay available, which is the whole of what a reader can do.
 */
export async function ArchivedEntityNotice() {
  const t = await getTranslations(PERIODS_MESSAGES);
  return (
    <Callout intent={CALLOUT_INTENT.INFO} title={t('archived.title')} action={null}>
      {t('archived.body')}
    </Callout>
  );
}
