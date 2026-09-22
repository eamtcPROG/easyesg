import { EmptyState, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { CENTRE_SHOW, centreViewQuery } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *empty — filtered* (task 50.2.1; §4.6): the centre holds notices, and none is unread. Its one action is
 * the filter cleared — the *All* tab — which is where every read notice still is.
 */
export async function CentreNothingUnread() {
  const t = await getTranslations(`${CENTRE_MESSAGES}.empty.nothingUnread`);
  return (
    <EmptyState
      title={t('title')}
      action={
        <TextLink asChild>
          <Link href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ show: CENTRE_SHOW.ALL, page: 1 }))}>
            {t('action')}
          </Link>
        </TextLink>
      }
    >
      {t('body')}
    </EmptyState>
  );
}
