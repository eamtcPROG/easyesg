import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { REALM_READ } from '~/realm/tools/realm-read';
import { supportAccessLogQuery } from '../../../queries/support-access';
import { inProgressOf, readLogOutcome } from '../../../tools/support-access-read';
import { withGrant, type SupportAccessSearch } from '../../../tools/support-access-search';
import { SupportAccessForbidden } from '../../shared/support-access-forbidden';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { SupportAccessUnavailable } from '../../shared/support-access-unavailable';
import { InProgressItem } from '../list/in-progress-item';

/**
 * What is in progress (task 67.9; UC-85) — requests an organization has yet to answer, and grants running now, each
 * running one with its countdown (UX-124). **The section reads and picks the arm**, and **it speaks for the whole
 * screen's refusals**: the log below reads the same realm, and one explanation of a boundary is enough.
 *
 * **Read from the log's first page**, newest first: a request is in progress for at most 24 hours and a grant for 60
 * minutes, so they are the newest entries — and reading it here shares the log region's cache and its poll.
 *
 * **Every Platform Administrator may end any running grant** (project owner, 14 Sep 2026), so each one offers the
 * end; **only the operator who asked may read under it**, so only their own offer the reports.
 */
export function InProgressSection({
  search,
  operatorId,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly operatorId: string;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const t = useTranslations('platform.supportAccess.inProgress');
  const query = useQuery(supportAccessLogQuery(1));
  const href = useLocation({ select: (location) => location.href });

  if (query.data === undefined) {
    return query.isError ? (
      <SupportAccessUnavailable onRetry={() => void query.refetch()} />
    ) : (
      <SupportAccessLoading />
    );
  }

  const read = readLogOutcome({ outcome: query.data, page: 1 });
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <Navigate to="/sign-in" search={{ redirect: href }} />;
    case REALM_READ.FORBIDDEN:
      return <SupportAccessForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <SupportAccessUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY: {
      const { awaiting, active } = inProgressOf(read.page.rows);
      return (
        <section aria-label={t('region')} className="flex flex-col gap-[var(--space-4)]">
          <h2 className="t-heading-2">{t('title')}</h2>
          {awaiting.length === 0 && active.length === 0 ? (
            <p className="t-body text-[var(--text-muted)]">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-3)]">
              {[...active, ...awaiting].map((entry) => (
                <li key={entry.id}>
                  <InProgressItem
                    entry={entry}
                    mayRead={entry.requesterId === operatorId}
                    onRead={() => onSearchChange(withGrant(search, entry.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
  }
}
