import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { UNSUBSCRIBE_MESSAGES } from '../shared/unsubscribe-messages';

/**
 * S-38's *already switched off* (task 52.2.2): from this link before, or from the profile. A success rather than an
 * error — the reader wanted these emails stopped, and they are. **Its way on is S-27** since task 52.3, where the choice
 * is reversed; reaching it asks for a sign-in, which the proxy does.
 */
export async function SwitchedOff({ categoryName, recipient }: { categoryName: string | null; recipient: string }) {
  const t = await getTranslations(UNSUBSCRIBE_MESSAGES);

  return (
    <Callout
      intent={CALLOUT_INTENT.SUCCESS}
      title={t('alreadyTitle')}
      action={
        <TextLink asChild>
          <Link href={ROUTES.ACCOUNT_PREFERENCES}>{t('profileAction')}</Link>
        </TextLink>
      }
    >
      {categoryName === null
        ? t('alreadyBodyUnnamed', { recipient })
        : t('alreadyBody', { category: categoryName, recipient })}
    </Callout>
  );
}
