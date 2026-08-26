'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { CodeField, type CodeFieldProps } from '../form/code-field';
import { useBoundField, type BoundRules } from './binding';

/**
 * `CodeField`, bound to a form — `control` and `name` are enough.
 *
 * **`value` is omitted from the caller's props and supplied from the controller**, which is the
 * one way this binding differs from `FormTextField`'s. `CodeField` is controlled by construction:
 * it paints the cells from the value, so it cannot fall back to the DOM the way an uncontrolled
 * text input can. `useController` already holds that value, so the binding is where it comes from
 * and no screen ever wires it by hand.
 *
 * `useController` also subscribes per field, where `register` plus a read of `formState.errors`
 * re-renders the whole form on any field's error — which matters more here than elsewhere, since
 * this control re-renders on every keystroke by design.
 */
export type FormCodeFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  CodeFieldProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Field-owned validation — required, length, shape. Messages arrive localized and three-part. */
  rules?: BoundRules<TValues, TName>;
};

export function FormCodeField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormCodeFieldProps<TValues, TName>) {
  const { id, error, input } = useBoundField({ control, name, rules });

  // No `?? ''` here: `useBoundField` already coerces react-hook-form's `undefined` initial value
  // to an empty string, precisely so a controlled input is never handed `undefined` — the
  // uncontrolled-to-controlled warning that reads as a React problem and is always this.
  return <CodeField {...presentation} {...input} id={id} error={error} />;
}
