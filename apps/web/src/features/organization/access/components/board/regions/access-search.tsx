'use client';

import { useTranslations } from 'next-intl';
import { ListSearch } from '@/shared/list-search';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { useAccess } from '../../shared/access-context';

/**
 * S-16's search over name and address (task 203.2; `design_spec.md` §4.7). The term is the view's like the facets, so
 * the board's one `setView` resets the page and the api answers what the term admits — the administrator count beside
 * the list is never narrowed by it.
 */
export function AccessSearch() {
  const t = useTranslations(ACCESS_MESSAGES);
  const { view, setView } = useAccess();

  return <ListSearch value={view.q} label={t('searchLabel')} onSearchAction={(q) => setView({ q })} />;
}
