/**
 * `platform/configuration` — A-05
 *
 * Mirrors `apps/api/src/modules/platform/configuration`. UC-80 … UC-82 · FR-71 … FR-74
 *
 * Emission factor sets, conditional-applicability thresholds and validation rule definitions — the
 * versioned configuration store AD-4 makes a first-class subsystem. Effective dates are calendar
 * dates with a timezone (NFR-34), not instants.
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
