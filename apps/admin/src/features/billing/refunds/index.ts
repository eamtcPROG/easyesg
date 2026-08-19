/**
 * `billing/refunds` — A-14
 *
 * Mirrors `apps/api/src/modules/billing/refunds`. UC-145 … UC-147 · FR-139 … FR-141
 *
 * Full and partial refunds, chargeback evidence packs and entitlement reversal. Refund authority is
 * separated from invoice issuance authority so no single account can both raise and reverse a charge.
 *
 * Boundary: `features/billing/**` and `features/platform/**` may not import each other.
 * `admin-billing-not-to-platform` and its mirror enforce it. Billing is a separate bounded context
 * (D-11): with `BILLING_ENABLED=false` the whole `/billing` subtree goes dark and every platform
 * screen must still work.
 *
 * Not built. Folders are `components/ hooks/ queries/ schema/ types/`, tests colocated as
 * `*.spec.tsx`. Data reaches this feature through TanStack Query against `/api/v1/admin/*` — an
 * ordinary client of the one public API (DR-11), never a privileged route.
 */
export {};
