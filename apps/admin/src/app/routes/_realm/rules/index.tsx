/**
 * A-05 — Factor sets and applicability thresholds · PA · UC-80, UC-81 · Editor
 *
 * The versioned, effective-dated emission and conversion factor sets that feed Scope 1 and location-based Scope 2, and the conditional-applicability thresholds (FR-71, FR-72).
 *
 * Effective dates here are calendar dates with their originating timezone (NFR-34), never epoch
 * instants — which factor set applies to a reporting period is a regulatory question a timezone
 * would change. Rule-only changes apply without a redeploy (FR-74).
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/rules/')({
  component: FactorsAndThresholdsRoute,
});

function FactorsAndThresholdsRoute() {
  return null;
}
