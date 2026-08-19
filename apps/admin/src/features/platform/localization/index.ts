/**
 * `platform/localization` — A-03
 *
 * Mirrors `apps/api/src/modules/platform/localization`. UC-71 … UC-74 · FR-61 … FR-64, FR-74
 *
 * Translatable content, translation-set publication, locale registration and the untranslated-key
 * queue. All three locales are separately authored — machine translation is prohibited, and
 * Romanian is the source.
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
