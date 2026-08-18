/**
 * `features/reporting`
 *
 * The wizard: modules, disclosure fields, autosave, change history.
 *
 * Mirrors `apps/api/src/modules/core/{report,disclosure}`. S-07, S-12.
 *
 * The disclosure field is the atomic unit of the product and gets its own build phase
 * (IMPLEMENTATION_PLAN Phase 4) because everything downstream inherits its decisions. Its
 * presentational half belongs to `packages/ui`; what lives here is the data binding.
 *
 * Not built. Folders are `components/ hooks/ schema/ queries/ types/`, tests colocated as
 * `*.spec.tsx`.
 */
export {};
