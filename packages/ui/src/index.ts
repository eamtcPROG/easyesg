/**
 * `@easyesg/ui` — the design system (design_spec.md §11).
 *
 * Nothing is exported yet. The build order is Phase 0 (token cascade, type scale, focus ring,
 * motion, dark map, expansion harness) then Phase 1 (primitives, form controls, feedback,
 * navigation, overlays, data display) — `design/IMPLEMENTATION_PLAN.md`.
 *
 * Three rules that hold from the first component:
 *
 * - **Tier discipline (UX-78).** Components read tier 3 component tokens, and tier 2 semantic
 *   roles where no tier 3 token exists. A component that reads a tier 1 variable — `--pine-*`,
 *   `--slate-*`, `--space-*`, `--radius-*` — is a defect, caught by grep in CI (§11.2).
 * - **Swappability (UX-79).** Re-skinning edits tier 1 only. Components never change.
 * - **State completeness (UX-8, UX-90).** Every archetype defines all eleven §8.1 states before
 *   any instance of it is designed. An undefined state is a defect, not an omission.
 */
export {};
