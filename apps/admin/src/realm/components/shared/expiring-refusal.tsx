import type { ApiFailure } from '@easyesg/contracts';
import { CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { refusalCopy } from '../../tools/refusal-copy';

/**
 * A submit the api refused, as the api said it — which leaves after a while, or when closed (`design_spec.md` §8.1,
 * amended 28 Sep 2026 by the project owner). `RefusalCallout` is the same words for a refused **read**, which stands:
 * a list that could not be loaded is not a message about the reader's last press.
 *
 * **Controlled**: it says it is done through `onDismiss`, and the caller stops rendering that failure — `useDismissible`
 * where the failure is local state, the reducer's own dismiss event where the notice moves between the board and a
 * record, since a notice that moves remounts and a hook's memory of it would not survive the move.
 */
export function ExpiringRefusal({
  failure,
  title,
  fallback,
  onDismiss,
}: {
  readonly failure: ApiFailure;
  /** Used where the problem document carries no title of its own. */
  readonly title: string;
  /** Used where it carries no detail. */
  readonly fallback: string;
  readonly onDismiss: () => void;
}) {
  const tUnreachable = useTranslations('realm.unreachable');
  const tChrome = useTranslations('chrome');
  const copy = refusalCopy({
    failure,
    title,
    fallback,
    unreachable: { title: tUnreachable('title'), body: tUnreachable('body'), action: tUnreachable('action') },
  });

  return (
    <ExpiringCallout
      intent={CALLOUT_INTENT.ERROR}
      title={copy.title}
      action={copy.action}
      dismissLabel={tChrome('closeMessage')}
      onDismiss={onDismiss}
    >
      {copy.body}
    </ExpiringCallout>
  );
}
