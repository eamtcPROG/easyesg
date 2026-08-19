/**
 * A-04 — Migration runs · PA · UC-78, UC-79 · Batch
 *
 * Execution of a taxonomy migration, bulk or report-by-report, and notification of affected organizations (FR-69, FR-70).
 *
 * FR-69 requires the pre-migration state be preserved rather than overwritten in place. UX-123's
 * scope disclosure is not cosmetic here — this is the widest blast radius in the product.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/taxonomy/migrations')({
  component: TaxonomyMigrationRoute,
});

function TaxonomyMigrationRoute() {
  return null;
}
