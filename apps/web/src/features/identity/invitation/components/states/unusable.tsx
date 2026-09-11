import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import type { UnusableStanding } from '../../tools/invitation';
import { INVITATION_MESSAGES } from '../shared/invitation-messages';

/**
 * The four recoverable states S-03 draws, told apart by the API's `standing` rather than by prose.
 *
 * One component and four message keys, not four components: the shape is identical — what happened,
 * why it cannot be undone here, and who can issue a new one — and the only thing that varies is the
 * sentence. Building four would have been the one-off-component defect UX-89 names, in the small.
 */
export async function Unusable({ standing }: { standing: UnusableStanding }) {
  const t = await getTranslations(INVITATION_MESSAGES);

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t(`standing.${standing}.title`)}
      action={
        <TextLink asChild>
          <Link href={ROUTES.SIGN_IN}>{t('standingAction')}</Link>
        </TextLink>
      }
    >
      {t(`standing.${standing}.body`)}
    </Callout>
  );
}
