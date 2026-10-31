import { Button, EmptyState } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';

/**
 * S-32's first-use state (§4.6: *an Index always has an empty state that teaches*): no article is published yet, so the
 * one action is the person who can answer — write to support.
 */
export async function LibraryEmpty() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <EmptyState
      title={t('empty.title')}
      action={
        <Button asChild>
          <Link href={ROUTES.HELP_CONTACT}>{t('empty.action')}</Link>
        </Button>
      }
    >
      {t('empty.body')}
    </EmptyState>
  );
}
