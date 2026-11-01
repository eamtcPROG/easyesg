import { useQuery } from '@tanstack/react-query';
import { REALM_READ } from '~/realm/tools/realm-read';
import { supportAccessLogQuery } from '../../../queries/support-access';
import { readLogOutcome } from '../../../tools/support-access-read';
import { logViewOf, type SupportAccessSearch } from '../../../tools/support-access-search';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { SupportAccessUnavailable } from '../../shared/support-access-unavailable';
import { LogBoard } from '../board/log-board';

/**
 * A-07's log (task 67.9; UC-86; FR-79) — the Index half: every request by every operator, newest first. **The
 * section reads and picks the arm; the board renders** (`section-reads-parts-render`). **Every Platform Administrator
 * reads the whole of it** (project owner, 14 Sep 2026), and nothing here edits an entry. **A session that ended and a
 * refused role draw nothing here**: the in-progress region reads the same realm and already says so.
 *
 * **Read at the page and size the address holds** (task 170). On the first page that is the in-progress region's
 * read too (`firstLogPageOf`), so the screen asks the api once.
 */
export function LogSection({
  search,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const view = logViewOf(search);
  const query = useQuery(supportAccessLogQuery(view));

  if (query.data === undefined) {
    return query.isError ? (
      <SupportAccessUnavailable onRetry={() => void query.refetch()} />
    ) : (
      <SupportAccessLoading />
    );
  }

  const read = readLogOutcome({ outcome: query.data, view });
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
    case REALM_READ.FORBIDDEN:
      return null;
    case REALM_READ.UNAVAILABLE:
      return <SupportAccessUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return (
        <LogBoard
          search={search}
          page={read.page}
          refreshing={query.isPlaceholderData}
          onSearchChange={onSearchChange}
        />
      );
  }
}
