/**
 * A-03 — Content and translation console · PA · UC-71, UC-73, UC-74 · Editor
 *
 * Authoring surface for translatable content: strings, additional locales, and the untranslated-key queue (FR-61, FR-63, FR-64).
 *
 * Config-as-data (AD-4, FR-74). Build as a generic editor over versioned configuration, not a
 * bespoke form — registering a locale must need no code change. All three locales are separately
 * authored; machine translation is prohibited.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/content/')({
  component: ContentConsoleRoute,
});

function ContentConsoleRoute() {
  return null;
}
