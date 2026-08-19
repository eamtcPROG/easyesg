/**
 * `billing/invoicing` — A-12
 *
 * Mirrors `apps/api/src/modules/billing/invoicing`. UC-126 … UC-136 · FR-121 … FR-130
 *
 * Proformas, fiscal invoices, credit notes, gapless per-series per-year numbering and the six-year
 * archive. Issued invoices are immutable; corrections are credit notes (D-10, FR-125).
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
