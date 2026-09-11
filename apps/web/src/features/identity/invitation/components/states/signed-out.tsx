import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Button, Panel, TextLink } from '@easyesg/ui';
import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { Link } from '@/i18n/navigation';
import { SocialProviders } from '../../../social/components/social-providers';
import styles from '../../../shared/styles/identity-screens.module.css';
import { invitationHandOff, type UsableInvitation } from '../../tools/invitation';
import { InvitationSummary } from '../parts/invitation-summary';
import { INVITATION_MESSAGES } from '../shared/invitation-messages';

/**
 * The hand-off (UX-38). Three routes and no forms — see the page header for why.
 *
 * The provider block streams behind the two password routes, for `async-suspense-boundaries`'
 * reason and S-01's: the provider list is an API round trip, and the routes that always work must
 * not wait on it. With the api unreachable it renders nothing and the two links stand alone.
 */
export async function SignedOut({ token, invitation }: { token: string; invitation: UsableInvitation }) {
  const t = await getTranslations(INVITATION_MESSAGES);
  const links = invitationHandOff(token);

  return (
    <div className={styles.stack}>
      <InvitationSummary invitation={invitation} />
      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>{t('signedOutIntro')}</p>
        <Button asChild>
          <Link href={links.register}>{t('createAccount')}</Link>
        </Button>
        <p className={`t-body-sm ${styles.altAction}`}>
          {t.rich('haveAccount', {
            link: (chunks) => (
              <TextLink asChild>
                <Link href={links.signIn}>{chunks}</Link>
              </TextLink>
            ),
          })}
        </p>
      </Panel>
      <Suspense fallback={null}>
        <SocialProviders
          intent={SOCIAL_SIGN_IN_INTENT.REGISTER}
          returnTo={links.returnPath}
        />
      </Suspense>
    </div>
  );
}
