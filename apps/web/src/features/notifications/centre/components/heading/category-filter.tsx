import { ARIA_CURRENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import type { CentreCategory } from '../../tools/centre-categories';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import styles from '../styles/centre.module.css';

/**
 * *All categories* and one link per category that travels in-app (task 37.3; §12.5.6's task-50.2 row (7)) — the filter
 * the second in-app category brought, the report-update notice beside the reminder.
 *
 * **Links, as the tabs and the order are**, for their reason: each choice is an address (UX-4), the one shown says so
 * with `aria-current`, and choosing keeps the read state and the order and starts again at the first page. **Drawn only
 * when there are two to choose between** — the caller's choices are empty otherwise (`centreCategories`).
 */
export async function CategoryFilter({
  view,
  categories,
}: {
  readonly view: CentreView;
  readonly categories: readonly CentreCategory[];
}) {
  const t = await getTranslations(`${CENTRE_MESSAGES}.category`);
  const choices = [{ key: null, name: t('all') }, ...categories];

  return (
    <ul className={styles.tabs} aria-label={t('label')}>
      {choices.map((choice) => (
        <li key={choice.key ?? ''}>
          <Link
            className={styles.tab}
            href={withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, category: choice.key, page: 1 }))}
            aria-current={view.category === choice.key ? ARIA_CURRENT.PAGE : undefined}
          >
            {choice.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
