'use client';

import { useId } from 'react';
import { useController } from 'react-hook-form';
import type { Control, FieldPath, FieldValues, RegisterOptions } from 'react-hook-form';

/**
 * The binding every bound control shares: one `useController` subscription, and the field id
 * the UX-111 summary links to.
 *
 * **Why the id needs a scope at all.** `TextField` will generate its own id from `useId()` when
 * the caller omits one — fine for the field, useless for the summary, which has to produce
 * `href="#<that id>"` without rendering the field. Every screen therefore hand-declared a
 * `const EMAIL_FIELD_ID`, passed it to the field AND repeated it in the summary array, where the
 * two could drift silently: rename the field and the summary link points at nothing. No gate
 * sees that.
 *
 * **Why a WeakMap.** The scope has to be derivable from `control` alone — that is the whole
 * point of the layer — and the summary may render before any field, after them, or not at all.
 * Keying on the control object means whichever consumer renders first seeds the scope and every
 * other one reads it, in any order. A `WeakMap` because the key is the caller's form: when the
 * form goes, so does the entry, with no cleanup to forget.
 *
 * **Why `useId` and not a counter.** A module counter increments per render on a long-lived
 * server and starts at zero in the browser, so the ids in the SSR HTML would not match the ids
 * the client computes — a hydration mismatch on every form. `useId` is the API that exists to be
 * stable across that boundary.
 *
 * The value is sanitized to word characters because React's `useId` output is punctuation-heavy
 * by design (it is meant for `id`, not for a selector), and the summary puts this id inside an
 * `href` fragment.
 */
const FORM_SCOPES = new WeakMap<object, string>();

const NON_WORD = /[^a-zA-Z0-9]/gu;

export function useFieldScope<TValues extends FieldValues>(control: Control<TValues>): string {
  // Called unconditionally, as hooks must be — it is only *used* when this consumer is the one
  // that seeds the scope.
  const candidate = `f${useId().replace(NON_WORD, '')}`;

  const existing = FORM_SCOPES.get(control);
  if (existing !== undefined) return existing;

  FORM_SCOPES.set(control, candidate);
  return candidate;
}

/** Named fields, not two adjacent strings — swapping them yields a real id that links nowhere. */
export function fieldElementId({ scope, name }: { scope: string; name: string }): string {
  return `${scope}-${name.replace(NON_WORD, '-')}`;
}

/**
 * react-hook-form's rules, with one narrowing: `required` must carry a **message**.
 *
 * `required: true` is valid react-hook-form and a trap here. It produces a `FieldError` with no
 * message, so the field renders no inline text, no `aria-invalid` and no summary entry — the
 * form simply refuses to submit and says nothing about why, which is the worst failure a form
 * has. NFR-79 already requires every error to state what failed, the consequence and the way
 * out; this makes the compiler ask for the first of those. Found by this layer's own spec, where
 * an `aria-invalid` assertion would not go true.
 *
 * The remaining message-less paths — a bare `pattern: /…/` rather than `{ value, message }`, or
 * a `validate` returning `false` — behave the same way and are not narrowed: they have honest
 * uses under a `validate` that supplies its own text, and the summary handles them by omitting
 * the entry rather than linking an empty one.
 */
export type BoundRules<TValues extends FieldValues, TName extends FieldPath<TValues>> = Omit<
  RegisterOptions<TValues, TName>,
  'required'
> & {
  /** Localized, three-part, from the caller — never a bare `true` (see above). */
  required?: string;
};

/**
 * One field's subscription. `useController` rather than `register` on purpose: it subscribes to
 * this field alone, where `register` plus a read of `formState.errors` re-renders the whole form
 * on any field's error — the more fields a screen has, the more that matters.
 */
export function useBoundField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
}: {
  control: Control<TValues>;
  name: TName;
  rules?: BoundRules<TValues, TName>;
}) {
  const { field, fieldState } = useController({ control, name, rules });
  const scope = useFieldScope(control);

  return {
    id: fieldElementId({ scope, name }),
    error: fieldState.error?.message,
    // `?? ''` is load-bearing: with no `defaultValues` the first render hands back `undefined`,
    // and React then logs "changing an uncontrolled input to be controlled" the moment someone
    // types. An empty string is what an empty text input holds.
    input: { ...field, value: field.value ?? '' },
  };
}
