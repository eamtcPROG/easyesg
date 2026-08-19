/**
 * `platform/taxonomy` — A-04
 *
 * Mirrors `apps/api/src/modules/platform/taxonomy`. UC-75 … UC-79 · FR-65 … FR-70
 *
 * Taxonomy and template versions, inter-version field mappings, the superseded-version exposure
 * view, migration runs and affected-organization notification. Version is a data dimension (DR-4).
 *
 * Boundary: `features/platform/**` and `features/billing/**` may not import each other.
 * `admin-platform-not-to-billing` and its mirror enforce it — the same separation DR-1 and D-11
 * hold in apps/api, and what makes `BILLING_ENABLED=false` testable on this surface too.
 *
 * Not built. Folders are `components/ hooks/ queries/ schema/ types/`, tests colocated as
 * `*.spec.tsx`. Data reaches this feature through TanStack Query against `/api/v1/admin/*` — an
 * ordinary client of the one public API (DR-11), never a privileged route.
 */
export {};
