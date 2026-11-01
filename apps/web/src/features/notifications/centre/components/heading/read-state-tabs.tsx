import { ARIA_CURRENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { NOTICE_SHOW } from '../../../shared/tools/notice-list-query';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';
import { NOTICE_LIST_MESSAGES } from '../../../shared/components/notice-messages';
import styles from '../styles/centre.module.css';

/**
 * *Unread · n* and *All* (task 50.2.1; §12.5.6's task-50.2 row (4)) — the artboards' two chips, and S-26's only
 * filter until two categories can reach the centre.
 *
 * **Links, not a toggle**: each view is its own address (UX-4), so the choice survives a reload and Back moves it,
 * and the one already shown says so with `aria-current`. Choosing either keeps the order and starts again at its
 * first page — staying on page 3 of a list that just became one page long would show nothing and read as *nothing
 * matches*.
 *
 * Here in the heading rather than in `shared/` because the heading is its one reader.
 */
export async function ReadStateTabs({ view, unread }: { readonly view: CentreView; readonly unread: number }) {
  const t = await getTranslations(`${NOTICE_LIST_MESSAGES}.show`);
  const tabs = [
    { show: NOTICE_SHOW.UNREAD, label: t('unread', { count: unread }) },
    { show: NOTICE_SHOW.ALL, label: t('all') },
  ];

  return (
    <ul className={styles.tabs} aria-label={t('label')}>
      {tabs.map((tab) => (
        <li key={tab.show}>
          <Link
            className={styles.tab}
            href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, show: tab.show, page: 1 }))}
            aria-current={view.show === tab.show ? ARIA_CURRENT.PAGE : undefined}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
