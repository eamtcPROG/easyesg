'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Checkbox, type CheckboxProps } from '../form/checkbox';
import { useBoundField, type BoundRules } from './binding';

/**
 * `Checkbox`, bound to a form — `control` and `name` are enough.
 *
 * **It spreads `toggle`, not `input`.** A checkbox holds its state in `checked`; `value` on an
 * `<input type="checkbox">` is the *string it submits*, so binding the value there renders an
 * unchecked box that never changes and nothing fails. `useBoundField` owns that adaptation — its
 * header says why the shapes live there rather than in each control — so this file is the same
 * three lines every other bound control is.
 *
 * The presentational half is untouched: this renders the same `Checkbox` an unbound caller does.
 */
export type FormCheckboxProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  CheckboxProps,
  'id' | 'error' | 'name' | 'value' | 'checked' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Validation the FIELD owns. A required checkbox carries its message like any other rule. */
  rules?: BoundRules<TValues, TName>;
};

export function FormCheckbox<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormCheckboxProps<TValues, TName>) {
  const { id, error, toggle } = useBoundField({ control, name, rules });

  return <Checkbox {...presentation} {...toggle} id={id} error={error} />;
}
