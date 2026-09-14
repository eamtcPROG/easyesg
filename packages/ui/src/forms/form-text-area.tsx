'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { TextArea, type TextAreaProps } from '../form/text-area';
import { useBoundField, type BoundRules } from './binding';

/**
 * `TextArea`, bound to a form — `FormTextField`'s binding over the multi-line control, and nothing more.
 *
 * **Added 14 Sep 2026 for A-07's request reason**, which had shipped as a single-line field for want of it. The
 * presentational control has existed since task 35.2 with its states, its `aria-describedby` wiring and its
 * summary anchor, so what was missing was only the bridge: the field id, the error and the UX-111 summary entry
 * derived from the same `control` as every other bound field. It lives here rather than in the console because
 * nothing about it is the console's — the wizard's narrative fields are the same control.
 *
 * What the caller still writes is everything this package cannot know: the label, the help, the length count, and
 * each rule's localized message.
 */
export type FormTextAreaProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = Omit<
  TextAreaProps,
  'id' | 'error' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  control: Control<TValues>;
  name: TName;
  /** Validation the FIELD owns — required, length. Messages arrive localized and three-part (NFR-79). */
  rules?: BoundRules<TValues, TName>;
};

export function FormTextArea<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...presentation
}: FormTextAreaProps<TValues, TName>) {
  const { id, error, input } = useBoundField({ control, name, rules });

  return <TextArea {...presentation} {...input} id={id} error={error} />;
}
