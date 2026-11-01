import { EmptyState, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *empty — first use* (task 50.2.1; §4.6): nothing has reached this reader's centre yet. It teaches what the
 * centre is for — storage, where a notice waits until it is read, even one that arrived while the reader was away
 * (UX-62) — and its one action is the way back to work, since nothing here can be made to arrive.
 */
export async function CentreFirstUse() {
  const t = await getTranslations(`${CENTRE_MESSAGES}.empty.firstUse`);
  return (
    <EmptyState
      title={t('title')}
      action={
        <TextLink asChild>
          <Link href={ROUTES.HOME}>{t('action')}</Link>
        </TextLink>
      }
    >
      {t('body')}
    </EmptyState>
  );
}
