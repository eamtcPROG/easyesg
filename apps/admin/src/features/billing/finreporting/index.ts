/**
 * `billing/finreporting` — A-16
 *
 * Mirrors `apps/api/src/modules/billing/finreporting`. UC-160 … UC-164 · FR-148 … FR-152
 *
 * VAT rates and tax rules, the revenue dashboard, the accounting export, the append-only billing
 * audit ledger and settlement reconciliation. Ledger entries are superseded, never edited (UX-126).
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
