import { EmptyState, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { NOTICE_SHOW } from '../../../shared/tools/notice-list-query';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *empty — filtered* (task 50.2.1; §4.6): the centre holds notices, and none is unread. Its one action is
 * the filter cleared — the *All* tab, in the order the reader chose — which is where every read notice still is.
 */
export async function CentreNothingUnread({ view }: { readonly view: CentreView }) {
  const t = await getTranslations(`${CENTRE_MESSAGES}.empty.nothingUnread`);
  return (
    <EmptyState
      title={t('title')}
      action={
        <TextLink asChild>
          <Link href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, show: NOTICE_SHOW.ALL, page: 1 }))}>
            {t('action')}
          </Link>
        </TextLink>
      }
    >
      {t('body')}
    </EmptyState>
  );
}
