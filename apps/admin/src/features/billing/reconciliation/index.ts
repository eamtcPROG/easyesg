/**
 * `billing/reconciliation` — A-10
 *
 * Mirrors `apps/api/src/modules/billing/reconciliation`. UC-137 … UC-140 · FR-131 … FR-134
 *
 * Statement import, automatic matching, and the exception workspace for missing references, partial
 * payments, overpayments, third-party payments and duplicates. Every resolution carries a
 * rationale (UX-125) which is itself the ledger entry (FR-134, FR-151).
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
