import { Banner, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { READ_ONLY_CAUSE, type ReadOnlyCause } from '@/server/data/wizard';
import { Link } from '@/i18n/navigation';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

/**
 * UX-13: *"a persistent banner stating which of the three causes applies and what restores
 * editing. Three different causes shall never produce one indistinguishable read-only screen."*
 * Each cause has its own words and its own remedy — the lock's is the period record (S-14), where
 * an administrator reopens it (UC-58); a viewer's is a person who can change their role.
 */
export async function ReadOnlyBanner({
  cause,
  periodHref,
}: {
  readonly cause: ReadOnlyCause;
  readonly periodHref: string;
}) {
  const t = await getTranslations(`${WIZARD_MESSAGES}.readOnly`);
  if (cause === READ_ONLY_CAUSE.LOCKED) {
    return (
      <Banner
        intent={CALLOUT_INTENT.INFO}
        title={t('lockedTitle')}
        action={
          <TextLink asChild>
            <Link href={periodHref}>{t('lockedAction')}</Link>
          </TextLink>
        }
      >
        {t('lockedBody')}
      </Banner>
    );
  }
  return (
    <Banner intent={CALLOUT_INTENT.INFO} title={t('viewerTitle')} action={null}>
      {t('viewerBody')}
    </Banner>
  );
}
