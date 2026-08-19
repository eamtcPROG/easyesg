/**
 * `billing/collections` — A-11
 *
 * Mirrors `apps/api/src/modules/billing/collections`. UC-141 … UC-144 · FR-135 … FR-138
 *
 * Dunning sequence, suspension, automatic restoration on settlement, and write-off. Suspension is
 * read-only access, never deletion — D-13 forbids a downgrade or non-payment destroying report data.
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
