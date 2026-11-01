'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { DateField, type DateFieldProps } from '../form/date-field';
import { useBoundField, type BoundRules } from './binding';

/**
 * `DateField`, bound to a form — `control` and `name` are enough. `FormTextField`'s header carries
 * the reasoning; this is the same binding over the same presentational control.
 *
 * **The bound value is the ISO date half only**, as the unbound control's is. Where the form
 * submits a legal date, the consuming app pairs it with the reporter's zone in one place — see
 * `DateField`'s header for why that pairing is the app's and not this package's.
 */
export type FormDateFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  DateFieldProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Field-level rules only, with localized three-part messages — `FormTextField`'s note applies. */
  rules?: BoundRules<TValues, TName>;
};

export function FormDateField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormDateFieldProps<TValues, TName>) {
  const { id, error, input } = useBoundField({ control, name, rules });

  return <DateField {...presentation} {...input} id={id} error={error} />;
}
