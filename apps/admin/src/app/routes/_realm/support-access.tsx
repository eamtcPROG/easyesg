/**
 * A-07 — Support access request and audit log · PA · UC-85, UC-86 · Focus + Index (task 67.9)
 *
 * The only route by which an operator reaches a specific organization's report data, and the log of every such
 * request (FR-77 … FR-79). D-5 is the binding constraint of this whole application: there is no standing access,
 * and this screen is the one exception path — **and since 14 Sep 2026 the exception is the organization's to give**
 * (FR-78 amended): an operator asks from here, an Organization Administrator answers in the tenant application, and
 * the grant lasts 60 minutes, read-only, with its own countdown (UX-124). The log is reviewable and never editable
 * (FR-79). The screen is `features/platform/support-access/`; this route owns only its addressable state and hands
 * the screen the signed-in operator, since only the operator who asked may read under a grant.
 *
 * **Every part of the view is in the URL** (UX-4): the organization a request is being written for (A-02's exit),
 * the grant being read with its report and module, the log's open entry and its page.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a link here
 * sees §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { SupportAccess } from '~/features/platform/support-access/components/section/support-access';
import { readSupportAccessSearch } from '~/features/platform/support-access/tools/support-access-search';

export const Route = createFileRoute('/_realm/support-access')({
  validateSearch: readSupportAccessSearch,
  component: SupportAccessRoute,
});

function SupportAccessRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { account } = Route.useRouteContext();

  return (
    <SupportAccess
      search={search}
      operatorId={account.id}
      onSearchChange={(next) => void navigate({ search: next })}
    />
  );
}
