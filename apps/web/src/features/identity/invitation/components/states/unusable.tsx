import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import {
  INVITATION_REMEDY,
  tellsTheReaderToSignIn,
  type InvitationRemedy,
  type UnusableStanding,
} from '../../tools/invitation';
import { INVITATION_MESSAGES } from '../shared/invitation-messages';

/**
 * The four recoverable states S-03 draws, told apart by the API's `standing` rather than by prose.
 *
 * One component and four message keys, not four components: the shape is identical — what happened,
 * why it cannot be undone here, and who can issue a new one — and the only thing that varies is the
 * sentence. Building four would have been the one-off-component defect UX-89 names, in the small.
 *
 * **The way out fits the reader** (task 114): a signed-in reader is offered their home page, where
 * the section resolved their session belongs, and a signed-out one sign-in. The already-used
 * sentence tells the reader to sign in, so it has a signed-in wording too; the other three never
 * mention signing in and keep one each.
 */
export async function Unusable({
  standing,
  remedy,
}: {
  standing: UnusableStanding;
  remedy: InvitationRemedy;
}) {
  const t = await getTranslations(INVITATION_MESSAGES);
  const signedIn = remedy.kind === INVITATION_REMEDY.HOME;

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t(`standing.${standing}.title`)}
      action={
        <TextLink asChild>
          <Link href={remedy.href}>{signedIn ? t('homeAction') : t('standingAction')}</Link>
        </TextLink>
      }
    >
      {signedIn && tellsTheReaderToSignIn(standing)
        ? t(`standing.${standing}.bodySignedIn`)
        : t(`standing.${standing}.body`)}
    </Callout>
  );
}
