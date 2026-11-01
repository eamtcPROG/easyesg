/**
 * A-06 — Adoption and usage metrics · PA · UC-83, UC-84 · Dashboard
 *
 * SMEs completing a full report, exports by format, average completion time and export-usage rate, filterable by period and segment and exportable (FR-83).
 *
 * FR-83 requires low-volume figures be marked low-confidence rather than shown as fact. Dashboard
 * is an admin-only archetype — it is never the tenant home (§4.6).
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/metrics')({
  component: AdoptionMetricsRoute,
});

function AdoptionMetricsRoute() {
  return null;
}
