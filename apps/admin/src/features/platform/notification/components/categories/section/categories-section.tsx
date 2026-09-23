import { useQuery } from '@tanstack/react-query';
import { SessionEnded } from '~/realm/components/shared/session-ended';
import { REALM_READ } from '~/realm/tools/realm-read';
import { notificationCategoriesQuery } from '../../../queries/notification-categories';
import { readCategoriesOutcome } from '../../../tools/categories-read';
import type { NotificationCategoriesSearch } from '../../../tools/notification-categories-search';
import { CategoriesBoard } from '../board/categories-board';
import { CategoriesForbidden } from '../states/categories-forbidden';
import { CategoriesLoading } from '../states/categories-loading';
import { CategoriesUnavailable } from '../states/categories-unavailable';

/**
 * A-17's categories region (task 67.10). **The section reads and picks the arm**: the categories, §5.2's permission
 * state for a Billing Operator, a sign-in for a session that ended, or a retry.
 */
export function CategoriesSection({
  search,
  onSearchChange,
}: {
  readonly search: NotificationCategoriesSearch;
  readonly onSearchChange: (next: NotificationCategoriesSearch) => void;
}) {
  const query = useQuery(notificationCategoriesQuery());

  if (query.data === undefined) {
    return query.isError ? <CategoriesUnavailable onRetry={() => void query.refetch()} /> : <CategoriesLoading />;
  }

  const read = readCategoriesOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <SessionEnded />;
    case REALM_READ.FORBIDDEN:
      return <CategoriesForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <CategoriesUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return <CategoriesBoard categories={read.categories} search={search} onSearchChange={onSearchChange} />;
  }
}
