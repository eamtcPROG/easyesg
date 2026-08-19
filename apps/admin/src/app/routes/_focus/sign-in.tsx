/**
 * A-01 — Admin sign-in · PA, BO · UC-68 · Focus · Phase 2
 *
 * Elevated sign-in for the administrative realm. MFA is mandatory and non-optional (FR-75, NFR-65): this surface shares no session, cookie scope or credential with the tenant application, and does not accept ordinary tenant credentials.
 *
 * UX-108 (Accessible Authentication) binds here explicitly: no cognitive function test, and
 * password managers and paste must work. The session it establishes is 8 h idle / 12 h absolute
 * (§12.5.6) — the only session lifetime the document set states.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_focus/sign-in')({
  component: AdminSignInRoute,
});

function AdminSignInRoute() {
  return null;
}
