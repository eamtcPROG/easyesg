/**
 * A-08 — Admin accounts and system audit log · PA · UC-87, UC-88 · Index (task 67.4)
 *
 * Every operator account in both realms and every pending invitation, each account's lifecycle —
 * invite, resend, revoke, suspend, reactivate, remove, release a lockout — and the platform-wide system
 * audit log (FR-80, FR-81). A Platform Administrator manages both realms' accounts (`actors.md` OQ-6,
 * closed 13 Sep 2026); privilege levels within the role are a recorded deferral (`design_spec.md` §5.2
 * A-08). The screen is `features/platform/admin/admin-accounts/`; this route owns only its addressable
 * state and hands the screen the signed-in operator, whose own account the record offers no ending to.
 *
 * **Every part of the view is in the URL** (UX-4): the open record or the invitation form, and the
 * log's filters and page — which is what *filters held in the URL, no named saved views* means.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a
 * link here sees §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { AdminAccounts } from '~/features/platform/admin/admin-accounts/components/section/admin-accounts';
import { readAccountsSearch } from '~/features/platform/admin/admin-accounts/tools/accounts-search';

export const Route = createFileRoute('/_realm/accounts')({
  validateSearch: readAccountsSearch,
  component: AdminAccountsRoute,
});

function AdminAccountsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { account } = Route.useRouteContext();

  return (
    <AdminAccounts
      search={search}
      operatorId={account.id}
      onSearchChange={(next) => void navigate({ search: next })}
    />
  );
}
