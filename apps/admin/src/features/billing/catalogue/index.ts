/**
 * `billing/catalogue` — A-09
 *
 * Mirrors `apps/api/src/modules/billing/catalogue`. UC-89 … UC-95 · FR-84 … FR-89
 *
 * Plans as versioned records, declarative entitlements and quotas, prices per currency and cycle,
 * grandfathering, publish/retire, discounts and trials. Three plans at MVP (D-12).
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
