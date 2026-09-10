import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-19 — Order, summary and confirmation · OA · UC-110…115 · Wizard
 *
 * UX-55: net, VAT rate and basis, gross and currency all shown before confirmation. UX-56: rails
 * are shown with availability *reasons* — MIA above its per-transaction ceiling appears as
 * unavailable with the reason, never silently omitted (D-8, FR-118).
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function OrderPage() {
  return <NotYetAvailable />;
}
