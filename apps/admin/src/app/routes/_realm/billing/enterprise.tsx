/**
 * A-15 — Enterprise quotes and contracts · BO · UC-153…UC-159 · Record
 *
 * Quote preparation and issuance, the signed contract and its negotiated terms, provisioning, custom billing schedules, and renewal and expiry (FR-142…FR-147).
 *
 * This screen exists because D-12 keeps Enterprise out of self-serve checkout entirely. It is the
 * manual path, and the record archetype rather than a queue because a contract is a long-lived
 * object an operator returns to, not work to be cleared.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/enterprise')({
  component: EnterpriseContractsRoute,
});

function EnterpriseContractsRoute() {
  return null;
}
