/**
 * `platform/admin` — A-02, A-08, A-18
 *
 * Mirrors `apps/api/src/modules/platform/admin`. UC-69, UC-70, UC-87, UC-88 · FR-75, FR-76, FR-80, FR-81, FR-82, FR-83
 *
 * The organization register, administrator accounts and privilege levels, the platform-wide system
 * audit log, and identity provider configuration. §6.6 assigns this whole FR range to one API
 * module, so it is one feature here rather than three.
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
