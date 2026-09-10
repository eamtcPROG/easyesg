import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-23 — Billing account · OA · UC-108 · Record
 *
 * The fiscal identity of the invoiced legal person. An e-Factura rejection caused by an invalid
 * buyer fiscal code routes back here — it cannot be fixed by editing the invoice (FR-125).
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function BillingAccountPage() {
  return <NotYetAvailable />;
}
