/**
 * `@easyesg/validation` — the rule interpreter.
 *
 * Shared between `apps/api` and `apps/web` (architecture.md §9.8): the wizard shows validation
 * inline as the user types (FR-40) and the server re-validates authoritatively in the same
 * request that persists the change (§11.1). **One rule interpreter, two execution sites, no
 * drift** — reimplementing the rules client-side for responsiveness is the failure this package
 * exists to prevent.
 *
 * The rules themselves are versioned configuration, not code (AD-4, D-G): coverage here is over
 * the interpreter, with the rule corpus as fixtures. Floors are 95% line / 90% branch (§12.5.6).
 *
 * Typing note (design_spec OQ-4, closed): the MACHINE states are canonical and the eight design
 * states are presentation labels derived from them. `ValidationState` carries six field-level
 * outcomes — OK, MISSING_VALUE, VALUE_INCONSISTENCY, ERROR, INVALID_URL, NOT_AVAILABLE.
 * `not_material` is section-level materiality (FR-41), its own enum on the module. `nil_return`
 * is not a validation state at all — a field carrying an affirmative zero is OK. Do not build a
 * flat eight-value enum; the mapping is declared once in `packages/contracts` and nowhere else.
 */
export {};
