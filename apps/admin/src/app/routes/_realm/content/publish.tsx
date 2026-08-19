/**
 * A-03 — Publish a translation set · PA · UC-72 · Publish
 *
 * Publication of a reviewed translation set across every tenant at once (FR-62).
 *
 * UX-123 governs: preview → scope disclosure (how many organizations, how many reports) →
 * confirm → progress → result → one-step revert. NFR-85 requires the change to reach production
 * within a working day and be revertible in one step.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/content/publish')({
  component: ContentPublishRoute,
});

function ContentPublishRoute() {
  return null;
}
