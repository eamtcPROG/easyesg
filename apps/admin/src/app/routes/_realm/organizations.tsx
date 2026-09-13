/**
 * A-02 — Organization register · PA · UC-69 · Index (task 67.3)
 *
 * Every organization on the platform at account-metadata level — name, IDNO, registration date,
 * active entity count, report count and the most recent member sign-in — and never report content
 * (FR-76, FR-77, D-5). A Platform Administrator's console home (A-01's exit) and the first
 * destination in the console nav. The screen is
 * `features/platform/admin/organization-register/`; this route owns only its addressable state.
 *
 * **Every part of the view is in the URL** (UX-4): the search, the order, the page and the open
 * record, read by `validateSearch` and written by navigating — so a link pasted into a support ticket
 * reopens exactly what the operator was looking at.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a
 * link here reaches the route, and `AdminRealmGuard` refuses the read — which the screen draws as
 * §5.2's permission state rather than hiding behind a client-side role check that would be a second,
 * weaker copy of the api's.
 */
import { createFileRoute } from '@tanstack/react-router';
import { OrganizationRegister } from '~/features/platform/admin/organization-register/components/section/organization-register';
import { readRegisterSearch } from '~/features/platform/admin/organization-register/tools/register-search';

export const Route = createFileRoute('/_realm/organizations')({
  validateSearch: readRegisterSearch,
  component: OrganizationRegisterRoute,
});

function OrganizationRegisterRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <OrganizationRegister search={search} onSearchChange={(next) => void navigate({ search: next })} />
  );
}
