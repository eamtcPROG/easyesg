import { ARIA_CURRENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { NOTICE_ORDER } from '../../../shared/tools/notice-list-query';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import styles from '../styles/centre.module.css';

/**
 * *Newest first* and *Oldest first* (§12.5.6's task-50.2 row (6)) — the Index archetype's sort, for a list whose one
 * order that matters is when each notice arrived (§4.6).
 *
 * **Links, as the tabs are**, for the tabs' reason: each order is an address (UX-4), and the one shown says so with
 * `aria-current`. Choosing either keeps the view and starts at its first page, since the page a reader was on
 * holds other notices in the other order. S-26's alone: the panel is always newest first.
 */
export async function ReceivedOrder({ view }: { readonly view: CentreView }) {
  const t = await getTranslations(`${CENTRE_MESSAGES}.order`);
  const orders = [
    { order: NOTICE_ORDER.NEWEST, label: t('newest') },
    { order: NOTICE_ORDER.OLDEST, label: t('oldest') },
  ];

  return (
    <ul className={styles.tabs} aria-label={t('label')}>
      {orders.map((option) => (
        <li key={option.order}>
          <Link
            className={styles.tab}
            href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, order: option.order, page: 1 }))}
            aria-current={view.order === option.order ? ARIA_CURRENT.PAGE : undefined}
          >
            {option.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
