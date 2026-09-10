import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-17 — Plan, entitlements and usage · OA · UC-65, UC-66 · Status
 *
 * UX-52: approaching-limit warnings sit against the counter in context, not in a banner
 * somewhere else.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function PlanAndUsagePage() {
  return <NotYetAvailable />;
}
