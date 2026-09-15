import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import styles from '../../shared/styles/identity-screens.module.css';
import { setPasswordKindOf } from '../tools/set-password-kind';
import { SetPasswordForm } from './set-password-form';
import { SET_PASSWORD_MESSAGES, setPasswordWordingFor } from './set-password-messages';

/**
 * S-02's set-password region: the link's parameters read, and the heading and either the form or the
 * missing-link state drawn from them (`section-reads-parts-render`; the page is a shell since task 155).
 *
 * **The link decides the wording** (`set-password-kind.ts`): `intent=setup` on the link sent to an
 * account holding no password, which is setting its first. The kind is worked out once, here, and handed
 * to the form, so the heading and the form cannot disagree about whom they address.
 *
 * A bare arrival (no token) is a broken or stripped link: the explanation offers the request route,
 * mirroring `/verify`'s two-surfaces-one-address split.
 */
export async function SetPasswordSection({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; intent?: string }>;
}) {
  const { token, intent } = await searchParams;
  const kind = setPasswordKindOf(intent);
  const [t, worded] = await Promise.all([
    getTranslations(SET_PASSWORD_MESSAGES),
    getTranslations(setPasswordWordingFor(kind)),
  ]);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{worded('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{worded('subtitle')}</p>
      {token ? (
        <SetPasswordForm token={token} kind={kind} />
      ) : (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t('missingTitle')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.RESET}>{t('missingAction')}</Link>
            </TextLink>
          }
        >
          {t('missingBody')}
        </Callout>
      )}
    </>
  );
}
