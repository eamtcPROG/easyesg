import { Callout, CALLOUT_INTENT, Panel } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { TENANT_READ } from '@/server/data/tenant-read';
import { OVERVIEW_MESSAGES } from './overview-messages';

/**
 * The two arms of `TENANT_READ` that are not `READY`, as §8.1 states them: `error — permission` and
 * `error — recoverable`.
 *
 * **One component over the vocabulary rather than two near-identical files**, because the arms are
 * already discriminated by `TENANT_READ` and the difference between them is three values. What it is
 * *not* is a boolean prop: a third arm added to that vocabulary fails the `Record` below rather than
 * rendering whichever branch the `if` happened to fall through to.
 *
 * **They are not interchangeable and collapsing them would lose a screen state.** `tenant-read.ts`
 * makes the same point about the vocabulary itself: *forbidden* is UX-1's boundary, which must name
 * who can grant access, and *unreachable* is a three-part "try again" the bundled catalogue owns
 * because the API could not supply one.
 *
 * **`action={null}` on the permission arm is a decision, not an omission.** UX-1's boundary state
 * names the remedy inside the message, so a slot repeating it would be the duplicated "what now"
 * `apps/web/CLAUDE.md` records — the other arm passes a sentence because reloading is a step the
 * message cannot perform.
 */
type UnavailableReason = typeof TENANT_READ.FORBIDDEN | typeof TENANT_READ.UNREACHABLE;

export async function OverviewUnavailable({ reason }: { readonly reason: UnavailableReason }) {
  const t = await getTranslations(OVERVIEW_MESSAGES);

  const intent: Record<UnavailableReason, typeof CALLOUT_INTENT.WARNING | typeof CALLOUT_INTENT.ERROR> = {
    [TENANT_READ.FORBIDDEN]: CALLOUT_INTENT.WARNING,
    [TENANT_READ.UNREACHABLE]: CALLOUT_INTENT.ERROR,
  };

  return (
    <Panel>
      <Callout
        intent={intent[reason]}
        title={t(`${reason}.title`)}
        action={reason === TENANT_READ.UNREACHABLE ? t('unreachable.action') : null}
      >
        {t(`${reason}.body`)}
      </Callout>
    </Panel>
  );
}
