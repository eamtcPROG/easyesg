import { BUTTON_VARIANT, Button, EmptyState } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';

/**
 * S-32's *nothing matches* — the library has articles and the narrowing kept none, so the action clears it (§4.6),
 * keeping the help's language where one is chosen (task 227).
 */
export async function LibraryNoMatch({ query }: { readonly query: Readonly<Record<string, string>> }) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <EmptyState
      title={t('noMatch.title')}
      action={
        <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
          <Link href={{ pathname: ROUTES.HELP_CENTRE, query }}>{t('noMatch.action')}</Link>
        </Button>
      }
    >
      {t('noMatch.body')}
    </EmptyState>
  );
}
