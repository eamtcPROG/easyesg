import { NotYetAvailable } from '@/shared/not-yet-available';

/**
 * S-25 — Enterprise request · OA · UC-153 · Focus
 *
 * The OA can request a quote but cannot provision Enterprise; provisioning sits with BO under
 * UC-156.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function EnterpriseRequestPage() {
  return <NotYetAvailable />;
}
