'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Select, type SelectProps } from '../form/select';
import { useBoundField, type BoundRules } from './binding';

/**
 * `Select`, bound to a form — `control` and `name` are enough, as with `FormTextField`.
 *
 * **The one place this differs from the other bound controls, and why it is spelled out rather
 * than spread.** `useBoundField` hands back an `input` shaped like a native input:
 * `{ name, value, onChange, onBlur, ref }`. A Radix `Select` takes `onValueChange`, not
 * `onChange`. A JSX spread does **not** check excess properties, so `{...input}` would compile,
 * drop `onChange` on the floor, and produce a select that renders correctly, opens correctly,
 * and never reports a choice to the form. Every field is wired by name here so that failure is
 * not available.
 *
 * Two properties fall out of that wiring rather than being arranged:
 *
 * - **`''` means "nothing chosen" on both sides.** `useBoundField` normalises an absent value to
 *   the empty string (its comment reasons about text inputs), and Radix reserves exactly `''` for
 *   "reset to the placeholder" — which is also why no `SelectOption` may use it as a value. So a
 *   form with no `defaultValues` shows its placeholder, with nothing to arrange.
 * - **`ref` reaches the trigger**, so react-hook-form's `shouldFocusError` moves focus to a select
 *   that failed validation. Without it a rejected submit would leave focus where it was and say
 *   nothing, which is the failure `BoundRules` narrows `required: true` out of the type to prevent
 *   in the other direction.
 *
 * `name` is forwarded, which makes Radix render its hidden native control: harmless under
 * `handleSubmit`, and it keeps the form natively submittable rather than quietly not.
 */
export type FormSelectProps<TValues extends FieldValues, TName extends FieldPath<TValues>> = Omit<
  SelectProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onValueChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Validation the FIELD owns — required, and little else a fixed option set can fail. Business
   *  rules are interpreted from `packages/validation`'s definitions instead, so a server verdict
   *  and an inline one cannot drift (architecture.md §9.8). Messages arrive localized and
   *  three-part (NFR-79). */
  rules?: BoundRules<TValues, TName>;
};

export function FormSelect<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormSelectProps<TValues, TName>) {
  const { id, error, choice } = useBoundField({ control, name, rules });

  return <Select {...presentation} {...choice} id={id} error={error} />;
}
