/**
 * `platform/metering` — A-06
 *
 * Mirrors `apps/api/src/modules/platform/metering`. UC-83, UC-84 · FR-83
 *
 * Adoption and usage metrics, filterable and exportable, with low-volume figures marked
 * low-confidence. Reads a cross-tenant rollup through the admin API — never tenant report content.
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
