/**
 * `billing/enterprise` — A-15
 *
 * Mirrors `apps/api/src/modules/billing/enterprise`. UC-153 … UC-159 · FR-142 … FR-147
 *
 * Quotes, signed contracts and negotiated terms, provisioning, custom billing schedules, renewal and
 * expiry. Exists because Enterprise never passes through self-serve checkout (D-12).
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
