/**
 * A-16 — Revenue, VAT export and billing audit ledger · BO · UC-160…UC-164 · Dashboard + Index
 *
 * VAT rates and tax rules, the revenue dashboard, the accounting export, the immutable billing audit ledger, and settlement reconciliation against recorded payments (FR-148…FR-152).
 *
 * UX-126: ledger entries are superseded, never edited, and the interface shall offer no affordance
 * that implies otherwise — the append-only guarantee is enforced by database privilege (DR-6), so a
 * visible edit control would be a lie the database refuses. D-14: MDL is the ledger currency and a
 * foreign-currency invoice carries its BNM rate date (FR-129) as a calendar date.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/revenue')({
  component: RevenueAndLedgerRoute,
});

function RevenueAndLedgerRoute() {
  return null;
}
