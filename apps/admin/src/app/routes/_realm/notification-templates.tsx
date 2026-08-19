/**
 * A-17 — Notification categories and templates · PA · UC-176 · Editor + Publish
 *
 * The category catalogue and its localized templates, as publishable configuration (FR-173).
 *
 * FR-173 puts this on the same mechanism as FR-61/FR-62 — the same versioned publish/revert flow
 * as A-03, so it is the same generic editor, not a second one. UX-123 governs publication.
 * Every template is a key; a literal sentence here needs a release to change (NFR-85).
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/notification-templates')({
  component: NotificationTemplatesRoute,
});

function NotificationTemplatesRoute() {
  return null;
}
