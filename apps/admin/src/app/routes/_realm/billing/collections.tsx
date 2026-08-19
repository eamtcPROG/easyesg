/**
 * A-11 — Collections and dunning · BO · UC-141…UC-144 · Exception queue
 *
 * The configurable dunning sequence, suspension, automatic restoration on settlement, and write-off with a reason and accounting treatment (FR-135…FR-138).
 *
 * D-13 is absolute: a downgrade or non-payment never destroys report data. FR-136 makes suspension
 * read-only access, not deletion — this screen must offer no affordance that implies otherwise.
 * UX-125 applies to a write-off.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/collections')({
  component: CollectionsRoute,
});

function CollectionsRoute() {
  return null;
}
