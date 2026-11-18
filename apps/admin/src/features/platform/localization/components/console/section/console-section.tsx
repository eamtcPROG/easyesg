import { useQuery } from '@tanstack/react-query';
import { SessionEnded } from '~/realm/components/shared/session-ended';
import { REALM_READ } from '~/realm/tools/realm-read';
import { contentConsoleQuery } from '../../../queries/content-console';
import { readContentConsoleOutcome } from '../../../tools/content-console-read';
import type { ContentConsoleSearch } from '../../../tools/content-console-search';
import { ConsoleBoard } from '../board/console-board';
import { ContentForbidden } from '../states/content-forbidden';
import { ContentLoading } from '../states/content-loading';
import { ContentUnavailable } from '../states/content-unavailable';

/**
 * A-03's region (task 67.5). **The section reads and picks the arm**: the board, the permission state for an operator
 * whose roles hold no content permission, a sign-in for a session that ended, or a retry.
 */
export function ConsoleSection({
  search,
  onSearchChange,
}: {
  readonly search: ContentConsoleSearch;
  readonly onSearchChange: (next: ContentConsoleSearch) => void;
}) {
  const query = useQuery(contentConsoleQuery());

  if (query.data === undefined) {
    return query.isError ? <ContentUnavailable onRetry={() => void query.refetch()} /> : <ContentLoading />;
  }

  const read = readContentConsoleOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <SessionEnded />;
    case REALM_READ.FORBIDDEN:
      return <ContentForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <ContentUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return <ConsoleBoard view={read.console} search={search} onSearchChange={onSearchChange} />;
  }
}
