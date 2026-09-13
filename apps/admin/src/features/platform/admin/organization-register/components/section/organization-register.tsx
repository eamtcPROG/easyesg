import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from '@tanstack/react-router';
import { organizationRegisterQuery } from '../../queries/organization-register';
import { REGISTER_READ, readRegisterOutcome } from '../../tools/register-read';
import { registerViewOf, type RegisterSearch } from '../../tools/register-search';
import { RegisterBoard } from '../board/section/register-board';
import { RegisterForbidden } from '../states/register-forbidden';
import { RegisterLoading } from '../states/register-loading';
import { RegisterUnavailable } from '../states/register-unavailable';

/**
 * A-02 — the organization register (task 67.3; UC-69, FR-76). **The section reads and picks the arm;
 * the parts render** (`section-reads-parts-render`): one query, and one of five things drawn from it.
 *
 * **Loading — initial** is a skeleton, and only initial: a later search keeps the previous page on
 * screen (`keepPreviousData`), which the board marks busy. **Signed out** navigates to A-01 carrying
 * this address, because a session that ended between the realm guard's probe and this read (task
 * 145) wants a sign-in, not an explanation. **Forbidden** is the permission state §5.2 asks for — a
 * Billing Operator who followed a link here. **Unavailable** is recoverable, with a retry.
 */
export function OrganizationRegister({
  search,
  onSearchChange,
}: {
  readonly search: RegisterSearch;
  readonly onSearchChange: (next: RegisterSearch) => void;
}) {
  const view = registerViewOf(search);
  const query = useQuery(organizationRegisterQuery(view));
  const href = useLocation({ select: (location) => location.href });

  if (query.data === undefined) {
    return query.isError ? (
      <RegisterUnavailable onRetry={() => void query.refetch()} />
    ) : (
      <RegisterLoading />
    );
  }

  const read = readRegisterOutcome({ outcome: query.data, page: view.page });
  switch (read.kind) {
    case REGISTER_READ.SIGNED_OUT:
      return <Navigate to="/sign-in" search={{ redirect: href }} />;
    case REGISTER_READ.FORBIDDEN:
      return <RegisterForbidden />;
    case REGISTER_READ.UNAVAILABLE:
      return <RegisterUnavailable onRetry={() => void query.refetch()} />;
    case REGISTER_READ.READY:
      return (
        <RegisterBoard
          search={search}
          view={view}
          page={read.page}
          refreshing={query.isPlaceholderData}
          onSearchChange={onSearchChange}
          onReload={() => void query.refetch()}
        />
      );
  }
}
