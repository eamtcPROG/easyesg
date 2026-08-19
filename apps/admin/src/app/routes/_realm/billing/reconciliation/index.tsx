/**
 * A-10 — Reconciliation workspace · BO · UC-137, UC-138 · Exception queue
 *
 * Bank statement import by file or bank API, and automatic matching against outstanding invoices (FR-131, FR-132).
 *
 * The exception queue is the admin console's primary archetype, as the wizard is the tenant app's
 * (§12). Keyboard-first, bulk-capable, dense. Every SYS failure path in the billing context
 * terminates in a queue like this one — UX-61 requires a named destination surface, not a log line.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/reconciliation/')({
  component: ReconciliationQueueRoute,
});

function ReconciliationQueueRoute() {
  return null;
}
