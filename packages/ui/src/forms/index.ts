/**
 * `@easyesg/ui/forms` — the react-hook-form binding over §11.5's form controls.
 *
 * **A separate entry point, deliberately.** The root `CLAUDE.md` rule is that `packages/ui`
 * stays presentational so re-skinning edits tier 1 only (UX-79) and the form library stays
 * replaceable. That rule is amended narrowly rather than broken: the presentational controls in
 * `../form/` still take `value`/`onChange`/`ref` and know nothing about any form library, this
 * folder is the only thing in the package that imports one, and the `@easyesg/ui` barrel does
 * not re-export it — so the PDF worker and the email renderer, which read this package for
 * UX-127's single source of values, never pull react-hook-form into their graph.
 * `ui-forms-out-of-the-barrel` in `.dependency-cruiser.cjs` is what keeps that true.
 *
 * react-hook-form is a **peer** dependency here: the apps own the catalog pin (§12.1), and a
 * second copy resolved for this package would give a field a different `Control` type than the
 * form that created it.
 */
export { FormTextField, type FormTextFieldProps } from './form-text-field';
export { FormPasswordField, type FormPasswordFieldProps } from './form-password-field';
export { FormSelect, type FormSelectProps } from './form-select';
export { FormSummary } from './form-summary';
export { fieldElementId, useBoundField, useFieldScope, type BoundRules } from './binding';
