import { getTranslations } from 'next-intl/server';
import { Callout, TextLink, type CalloutProps } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { SOCIAL_NOTICE, isSocialNotice, type SocialNotice } from '../social';
import { ROUTES } from '@/lib/routes';

/**
 * The callback's `?notice=` rendered as S-01's callout (task 24) — NFR-79's three parts, all
 * from the catalogue. The param round-trips the browser, so it is validated against the closed
 * vocabulary and anything else renders nothing: an unrecognised token is a crafted URL, not a
 * state this screen owes an explanation for.
 */
const NOTICE_KEY = {
  [SOCIAL_NOTICE.CANCELLED]: 'cancelled',
  [SOCIAL_NOTICE.RESTART]: 'restart',
  [SOCIAL_NOTICE.UNAVAILABLE]: 'unavailable',
  [SOCIAL_NOTICE.FAILED]: 'failed',
  [SOCIAL_NOTICE.EMAIL_IN_USE]: 'emailInUse',
  [SOCIAL_NOTICE.VERIFY_SENT]: 'verifySent',
  [SOCIAL_NOTICE.UNKNOWN_IDENTITY]: 'unknownIdentity',
} as const;

const NOTICE_INTENT: Record<SocialNotice, CalloutProps['intent']> = {
  [SOCIAL_NOTICE.CANCELLED]: 'info',
  [SOCIAL_NOTICE.RESTART]: 'attention',
  [SOCIAL_NOTICE.UNAVAILABLE]: 'attention',
  [SOCIAL_NOTICE.FAILED]: 'error',
  [SOCIAL_NOTICE.EMAIL_IN_USE]: 'attention',
  [SOCIAL_NOTICE.VERIFY_SENT]: 'success',
  [SOCIAL_NOTICE.UNKNOWN_IDENTITY]: 'info',
};

export interface SocialNoticeCalloutProps {
  /** The raw `?notice=` value, unvalidated — this component owns the narrowing. */
  notice?: string;
}

export async function SocialNoticeCallout({ notice }: SocialNoticeCalloutProps) {
  if (!notice || !isSocialNotice(notice)) return null;
  const t = await getTranslations('identity.social.notice');
  const key = NOTICE_KEY[notice];

  const action =
    notice === SOCIAL_NOTICE.VERIFY_SENT ? (
      // The one notice whose "what now" is a navigation: S-02's resend surface.
      <TextLink asChild>
        <Link href={ROUTES.VERIFY}>{t(`${key}.action`)}</Link>
      </TextLink>
    ) : (
      t(`${key}.action`)
    );

  return (
    <Callout intent={NOTICE_INTENT[notice]} title={t(`${key}.title`)} action={action}>
      {t(`${key}.body`)}
    </Callout>
  );
}
