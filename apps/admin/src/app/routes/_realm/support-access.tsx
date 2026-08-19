/**
 * A-07 — Support access request and audit log · PA · UC-85, UC-86 · Focus + Index
 *
 * The only route by which an operator reaches a specific organization's report data, and the log of every such grant (FR-78, FR-79).
 *
 * D-5 is the binding constraint of this entire application: there is no standing access, and this
 * screen is the sole exception path. UX-124 — a stated reason and ticket reference, a visible
 * expiry countdown while active, and the console must make it evident the access is observed.
 * FR-79: the log is reviewable but not editable from within the console.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/support-access')({
  component: SupportAccessRoute,
});

function SupportAccessRoute() {
  return null;
}
