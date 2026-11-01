/**
 * A-09 — Plan catalogue, entitlements, pricing and discounts · BO · UC-89…UC-95 · Editor
 *
 * Plans as versioned first-class records: declarative entitlements and quotas, prices per currency and billing cycle, versioning with grandfathering, publish/retire, discounts and trial terms (FR-84…FR-89).
 *
 * D-12 fixes three plans at MVP — Free, Standard, Enterprise — and Enterprise never passes through
 * self-serve checkout, which is why A-15 exists separately. Config-as-data like A-03/A-04/A-05/
 * A-17: a new entitlement key must need no code change. UX-123 governs a plan version change.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/plans')({
  component: PlanCatalogueRoute,
});

function PlanCatalogueRoute() {
  return null;
}
