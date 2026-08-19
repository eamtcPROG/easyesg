/**
 * A-10 — Resolve a reconciliation exception · BO · UC-139, UC-140 · Exception queue
 *
 * Manual resolution of a missing or mistyped reference, partial payment, overpayment, third-party payment or duplicate (FR-133, FR-134).
 *
 * UX-125: every manual resolution is a financial assertion and requires a rationale. FR-134 adds
 * that manual settlement writes to the append-only ledger (FR-151) with its stated reason — the
 * rationale is not a UI nicety, it is the ledger entry.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/reconciliation/$exceptionId')({
  component: ReconciliationExceptionRoute,
});

function ReconciliationExceptionRoute() {
  return null;
}
