import type { ApiFailure } from '@easyesg/contracts';
import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { refusalCopy } from '../../tools/refusal-copy';

/**
 * A read the api refused, drawn as the api said it (tasks 67.4) — the members of an organization, the organization a
 * request is for, an invitation that can no longer be used. **It stands**: a refused read is the state of the screen,
 * not a message about the reader's last press. A refused submit is `ExpiringRefusal`, the same words, which leaves
 * after a while (`design_spec.md` §8.1, 28 Sep 2026). The words themselves are `refusalCopy`'s.
 */
export function RefusalCallout({
  failure,
  title,
  fallback,
}: {
  readonly failure: ApiFailure;
  /** Used where the problem document carries no title of its own. */
  readonly title: string;
  /** Used where it carries no detail. */
  readonly fallback: string;
}) {
  const t = useTranslations('realm.unreachable');
  const copy = refusalCopy({
    failure,
    title,
    fallback,
    unreachable: { title: t('title'), body: t('body'), action: t('action') },
  });

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={copy.title} action={copy.action}>
      {copy.body}
    </Callout>
  );
}
