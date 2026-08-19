/**
 * `billing/efactura` — A-13
 *
 * Mirrors `apps/api/src/modules/billing/efactura`. UC-130 · FR-127
 *
 * e-Factura transmission failures and rejections, surfaced with a reason a person can act on. An
 * untransmitted invoice is never marked delivered. Mandate: 1 October 2026.
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
