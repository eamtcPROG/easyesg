/**
 * A-18 — Identity provider configuration · PA · UC-70 · Editor
 *
 * Registration, enabling, disabling and credential rotation for social identity providers, without a redeploy (FR-82).
 *
 * D-6 puts social sign-in in scope and enterprise SSO out. Credentials are written, never read
 * back — NFR-69 governs secret handling, and this screen must not become a place secrets can be
 * retrieved. UX-70 applies to disabling a provider tenants are actively signing in with.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/identity-providers')({
  component: IdentityProvidersRoute,
});

function IdentityProvidersRoute() {
  return null;
}
