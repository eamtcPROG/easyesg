import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-21 — Payment instruments · OA · UC-118, UC-119 · Index
 *
 * UX-60: saved-instrument consent is explicit, separately recorded, and worded as a recurring
 * authorisation.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function PaymentInstrumentsPage() {
  return <NotYetAvailable />;
}
