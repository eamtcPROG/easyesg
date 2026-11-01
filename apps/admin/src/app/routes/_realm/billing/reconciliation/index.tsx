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
 *
 * **An exception is `?exception=<id>` on this route, not a page of its own** (task 203.4; `design_spec.md` §5.2's
 * preamble: *"a record … opens in a modal dialogue over it, still addressable"*). The scaffold had a sibling route,
 * `billing/reconciliation/$exceptionId`, which would have replaced the queue rather than opening over it; it is gone,
 * and the queue's address carries the exception the way A-02 carries `?selected=` and A-08 `?panel=`. UC-139 and
 * UC-140 — resolving an exception, with UX-125's rationale — are that dialogue's, drawn when this screen is built. The
 * reader is one line and lives here until then: the feature folder is an unbuilt barrel, which a `tools/` beside it
 * would make a directory of files and folders both.
 */
import { createFileRoute } from '@tanstack/react-router';

/** The exception whose dialogue is open — kept only when it names something, as A-02's `selected` is. */
interface ReconciliationSearch {
  readonly exception?: string;
}

export const Route = createFileRoute('/_realm/billing/reconciliation/')({
  validateSearch: (raw: Record<string, unknown>): ReconciliationSearch =>
    typeof raw.exception === 'string' && raw.exception.length > 0 ? { exception: raw.exception } : {},
  component: ReconciliationQueueRoute,
});

function ReconciliationQueueRoute() {
  return null;
}
