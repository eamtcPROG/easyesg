/**
 * A-12 — Invoicing, credit notes and numbering series · BO · UC-126…UC-136 · Index + Record
 *
 * Proformas, issued fiscal invoices, credit notes, the per-series per-year numbering, and the statutory archive (FR-121…FR-130).
 *
 * D-10 and FR-125: an issued invoice is immutable and corrections are credit notes — there is no
 * edit affordance to build. Numbering is gapless and monotonic per series per year under lock at
 * issuance (DR-8, AD-7, FR-123). UX-71 governs issuance: irreversible by design, and the interface
 * must say so before the fact. Invoice dates are calendar dates with a timezone (NFR-34), never
 * epoch instants — encoding 31 December as an instant is how a document lands in the wrong fiscal
 * year, and FR-125 makes that uncorrectable by editing.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/invoices')({
  component: InvoicingRoute,
});

function InvoicingRoute() {
  return null;
}
