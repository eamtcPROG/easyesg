/**
 * `platform/notification` — A-17
 *
 * Mirrors `apps/api/src/modules/platform/notification`. UC-176 · FR-173
 *
 * Notification categories and their localized templates, on the same publish/revert mechanism as
 * FR-61/FR-62.
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
