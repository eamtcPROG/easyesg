/**
 * A-14 — Refunds and chargebacks · BO · UC-145…UC-147 · Exception queue
 *
 * Full and partial refunds, the chargeback evidence pack, and entitlement reversal as a distinct step (FR-139…FR-141).
 *
 * FR-139 separates refund authority from invoice issuance authority so that no single account can
 * both raise a charge and reverse it. That separation is an authorization fact enforced server-side
 * (FR-158, NFR-62) — hiding the control is not implementing it. UX-125 applies.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/refunds')({
  component: RefundsRoute,
});

function RefundsRoute() {
  return null;
}
