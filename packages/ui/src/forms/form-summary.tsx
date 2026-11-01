'use client';

import type { ReactNode } from 'react';
import { useFormState } from 'react-hook-form';
import type { Control, FieldValues } from 'react-hook-form';
import { FormErrorSummary, type FormErrorSummaryItem } from '../form/form-error-summary';
import { fieldElementId, useFieldScope } from './binding';

/**
 * The UX-111 summary, bound to a form — `control` and a title are enough.
 *
 * It exists because the bound fields generate their own ids: a hand-written summary can no
 * longer name them, so deriving both sides from the same `control` is what keeps the link and
 * its target in step. That was the failure worth removing — the id, the field and the summary
 * entry were three hand-kept copies of one fact, and a rename broke the link with nothing
 * failing anywhere.
 *
 * Held to the shape every screen wrote by hand: nothing before the first submit attempt (a
 * summary that appears while someone is still filling the first field is noise), nothing when
 * there is nothing to say, and the messages exactly as the rules supplied them — localized and
 * three-part, from the caller (NFR-79).
 */
export function FormSummary<TValues extends FieldValues>({
  control,
  title,
}: {
  control: Control<TValues>;
  /** Localized, from the caller — what is wrong at form level. */
  title: ReactNode;
}) {
  const { errors, submitCount } = useFormState({ control });
  const scope = useFieldScope(control);

  if (submitCount === 0) return null;

  return <FormErrorSummary title={title} items={collectItems({ errors, scope, path: '' })} />;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Walks the error tree in registration order, which is field order on every screen here.
 *
 * A leaf is identified by its `type` — react-hook-form's own discriminator for a `FieldError`.
 * Testing for `message` instead would be wrong twice: a rule declared `required: true` produces
 * a leaf with no message, and without the `type` check this would then recurse into that leaf's
 * `ref`, walking a DOM node.
 */
function collectItems({
  errors,
  scope,
  path,
}: {
  errors: Record<string, unknown>;
  scope: string;
  path: string;
}): FormErrorSummaryItem[] {
  const items: FormErrorSummaryItem[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (!isRecord(value)) continue;
    const name = path ? `${path}.${key}` : key;

    if (typeof value.type === 'string') {
      if (typeof value.message === 'string' && value.message.length > 0) {
        items.push({ fieldId: fieldElementId({ scope, name }), message: value.message });
      }
      continue;
    }

    items.push(...collectItems({ errors: value, scope, path: name }));
  }

  return items;
}
