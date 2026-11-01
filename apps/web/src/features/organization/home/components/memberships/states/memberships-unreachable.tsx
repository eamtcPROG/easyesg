import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';

/**
 * §8.1's `error — recoverable` for the membership list alone — the read failed while the rest of
 * S-05 loaded (task 30.5; its own file since task 128).
 *
 * **S-35's wording is deliberately not repeated, and that is the whole point of this arm.** That
 * screen exists for the sign-in-time failure where nothing resolved and the reader has nowhere to
 * be; here they are already inside an organization and only this region did not load, so it says
 * *that*. Task 25.4's recorded obligation is discharged by the two states saying different things
 * rather than by one of them being silent.
 *
 * **It is the region's only non-ready arm, which is why `states/` holds one file.** There is no
 * `empty` to write: §4.3's post-sign-in branch sends a reader who belongs to nothing to S-04, so a
 * reader who can see this screen holds at least one membership by construction. A folder of one is
 * the honest count, not a folder waiting to be filled.
 *
 * **`action` carries a sentence rather than `null`**, unlike the overview's permission arm: this
 * failure is retryable and reloading is a step the message itself cannot perform, which is the
 * distinction `overview-unavailable.tsx` draws between its own two arms.
 */
export async function MembershipsUnreachable() {
  const t = await getTranslations(MEMBERSHIPS_MESSAGES);

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t('unreachable.title')}
      action={t('unreachable.action')}
    >
      {t('unreachable.body')}
    </Callout>
  );
}
