import { EmptyState, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *empty — filtered* when a category is chosen (task 37.3; §4.6): the centre holds notices, and none of this
 * category in the view shown. Its one action clears the category and keeps the read state — one filter at a time, so
 * a centre with nothing unread anywhere then says that in its own words.
 */
export async function CentreNothingInCategory({ view }: { readonly view: CentreView }) {
  const t = await getTranslations(`${CENTRE_MESSAGES}.empty.nothingInCategory`);
  return (
    <EmptyState
      title={t('title')}
      action={
        <TextLink asChild>
          <Link href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, category: null, page: 1 }))}>
            {t('action')}
          </Link>
        </TextLink>
      }
    >
      {t('body')}
    </EmptyState>
  );
}
