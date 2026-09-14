/**
 * A-18 — Identity provider configuration · PA · UC-70 · Record (task 67.11)
 *
 * Registering, enabling, disabling and rotating the client id of the social providers FR-2 names, with no redeploy
 * (FR-82). **A provider has two halves and the screen keeps them apart** (project owner, 14 Sep 2026): its
 * behaviour, which an operator edits here, and its client secret, which the server's environment holds and this
 * screen reports on — held or not, and where it is set — without ever reading it back. **The secret in the
 * environment is a recorded deviation from NFR-69, not compliance with it** (§12.5.6's task-24 configuration row),
 * and task 154 moves it into the secret manager. Disabling
 * names who it reaches (UX-70). The screen is `features/platform/admin/identity-providers/`; this route owns only
 * its addressable state.
 *
 * **Every part of the view is in the URL** (UX-4): the provider whose record is open.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a link here
 * sees §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { IdentityProviders } from '~/features/platform/admin/identity-providers/components/section/identity-providers';
import { readIdentityProvidersSearch } from '~/features/platform/admin/identity-providers/tools/identity-providers-search';

export const Route = createFileRoute('/_realm/identity-providers')({
  validateSearch: readIdentityProvidersSearch,
  component: IdentityProvidersRoute,
});

function IdentityProvidersRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return <IdentityProviders search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
