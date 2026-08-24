'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { TextField, type TextFieldProps } from '../form/text-field';
import { useBoundField, type BoundRules } from './binding';

/**
 * `TextField`, bound to a form — `control` and `name` are enough.
 *
 * What the caller no longer writes: the field id constant, `id=`, `error={errors.x?.message}`,
 * the `register()` spread, and the matching entry in the UX-111 summary array (`FormSummary`
 * derives the same id from the same `control`). What it still writes is everything this package
 * cannot know: the label, the help text, the input's own semantics, and the localized message on
 * each rule — `packages/ui` renders text and owns none.
 *
 * The presentational half is untouched: this renders the same `TextField` every unbound caller
 * does, so the states, the `aria-describedby` wiring and the token cascade have exactly one
 * implementation (UX-127). Replacing react-hook-form later means deleting `src/forms/`, not
 * editing a control.
 */
export type FormTextFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  TextFieldProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Validation the FIELD owns — required, shape, length. Business rules are interpreted from
   *  `packages/validation`'s definitions instead, so a server verdict and an inline one cannot
   *  drift (architecture.md §9.8). Messages arrive localized and three-part (NFR-79). */
  rules?: BoundRules<TValues, TName>;
};

export function FormTextField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormTextFieldProps<TValues, TName>) {
  const { id, error, input } = useBoundField({ control, name, rules });

  return <TextField {...presentation} {...input} id={id} error={error} />;
}
