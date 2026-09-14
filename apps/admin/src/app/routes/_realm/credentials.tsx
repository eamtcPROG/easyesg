/**
 * A-19 — My credentials · PA, BO · UC-212 · Record (task 151)
 *
 * The operator's own password, second factor and recovery codes (FR-80), reached from the account menu
 * for both privilege levels and from A-01 after a recovery sign-in. The screen is
 * `realm/components/credentials/`; this route owns only the addressable state — the arrival notice —
 * and hands the screen the operator the realm guard resolved, whose address names the record.
 *
 * **In `realm/`, not under `features/`**, A-01's reason: it serves a Platform Administrator and a
 * Billing Operator alike and belongs to neither context. The realm guard admits both, and so does the
 * api (task 144's `/admin/credentials` names both roles).
 */
import { createFileRoute } from '@tanstack/react-router';
import { CredentialsScreen } from '~/realm/components/credentials/section/credentials-screen';
import { readCredentialsArrival, type CredentialsArrival } from '~/realm/tools/credentials-arrival';

export const Route = createFileRoute('/_realm/credentials')({
  validateSearch: (search: Record<string, unknown>): { notice?: CredentialsArrival } => ({
    notice: readCredentialsArrival(search.notice),
  }),
  component: CredentialsRoute,
});

function CredentialsRoute() {
  const { notice } = Route.useSearch();
  const { account } = Route.useRouteContext();

  return <CredentialsScreen account={account} arrival={notice} />;
}
