/**
 * A-04 — Taxonomy versions and field mappings · PA · UC-75, UC-76, UC-77 · Editor
 *
 * Registration of taxonomy and template versions with an explicit backwards-compatibility determination, the field mapping between versions, and the exposure view of reports still on a superseded version (FR-65…FR-68).
 *
 * Version is a data dimension (DR-4): a report pins its template and taxonomy version, so this
 * screen edits the dimension every report is pinned to. EFRAG artefacts are registered here, never
 * fetched live (§5.3).
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/taxonomy/')({
  component: TaxonomyVersionsRoute,
});

function TaxonomyVersionsRoute() {
  return null;
}
