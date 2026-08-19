/**
 * A-08 — Administrator accounts and system audit log · PA · UC-87, UC-88 · Index
 *
 * Creation, modification and deactivation of platform administrator accounts with separable privilege levels, and the platform-wide system audit log (FR-80, FR-81).
 *
 * Privilege levels are separable by design: a translator does not need a taxonomy migration
 * operator's rights, and BO's billing authority is not PA's to hold. UX-70 — removal must disclose
 * its consequences. Blocked on architecture.md OQ-6 (whether BO accounts are provisioned here at
 * all, which would partly undo the separation of duties).
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/accounts')({
  component: AdminAccountsRoute,
});

function AdminAccountsRoute() {
  return null;
}
