/**
 * `features/commerce`
 *
 * Plans, orders, payment rails, invoices, subscription.
 *
 * Mirrors `apps/api/src/modules/billing`. S-17 through S-25.
 *
 * **Nothing outside this folder may import from it.** `web-not-to-commerce` in
 * .dependency-cruiser.cjs enforces it, with a fixture proving the rule rejects a real violation.
 *
 * The reason is acceptance condition A6: with `BILLING_ENABLED=false` the reporting core must
 * still pass UC-17…48 end to end. That is the web-side mirror of `core-not-to-billing` in
 * apps/api, and it is the standing verification that Layer 1 holds no commercial logic (D-11).
 *
 * No card field exists here or anywhere else - card capture is the acquirer's hosted page, and
 * NFR-60 is verified by DOM review confirming no platform-served PAN field (D-7, PCI SAQ-A).
 *
 * Not built. Folders are `components/ hooks/ schema/ queries/ types/`, tests colocated as
 * `*.spec.tsx`.
 */
export {};
