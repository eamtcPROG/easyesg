import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-22 — Invoices and documents · OA · UC-132, UC-157 · Index
 *
 * D-10: an issued invoice is immutable; corrections are credit notes. D-13: previously generated
 * documents stay downloadable through lapse, downgrade and suspension.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function InvoicesPage() {
  return <NotYetAvailable />;
}
