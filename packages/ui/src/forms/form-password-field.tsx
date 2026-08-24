'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { PasswordField, type PasswordFieldProps } from '../form/password-field';
import { useBoundField, type BoundRules } from './binding';

/**
 * `PasswordField`, bound to a form — the `FormTextField` contract with the reveal toggle's two
 * labels still required, because they are text and this package owns none.
 *
 * UX-108 is unchanged and unchangeable here: the control underneath is still a real
 * `<input type="password">`, so paste and password-manager autofill work. Binding through
 * `useController` does not intercept input events — the caller's `autoComplete` still decides
 * what the manager offers.
 */
export type FormPasswordFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  PasswordFieldProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  rules?: BoundRules<TValues, TName>;
};

export function FormPasswordField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({ control, name, rules, ...presentation }: FormPasswordFieldProps<TValues, TName>) {
  const { id, error, input } = useBoundField({ control, name, rules });

  return <PasswordField {...presentation} {...input} id={id} error={error} />;
}
