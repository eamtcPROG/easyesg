/**
 * A-02 — Organization register · PA · UC-69 · Index
 *
 * Searchable register of every organization at account-metadata level — registration date, entity count, plan, activity.
 *
 * FR-76 is explicit that this screen "shall never expose report content", and FR-77 forbids any
 * standing access to it. Report data reaches an operator only through A-07's time-boxed grant.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/organizations')({
  component: OrganizationRegisterRoute,
});

function OrganizationRegisterRoute() {
  return null;
}
