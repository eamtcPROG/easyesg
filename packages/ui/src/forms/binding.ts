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
 * One field's subscription, in the two shapes a control can take.
 *
 * `useController` rather than `register` on purpose: it subscribes to this field alone, where
 * `register` plus a read of `formState.errors` re-renders the whole form on any field's error —
 * the more fields a screen has, the more that matters.
 *
 * **Why three shapes rather than one.** A native text input reports a change as an *event*
 * (`onChange`) and holds its state in `value`; a Radix control reports the *value*
 * (`onValueChange`), because there is no event to read it from; and a checkbox or switch is an
 * event again but holds its state in **`checked`**, where `value` means the string it submits. The
 * adaptation between them lives here, once, rather than in each bound control — the same reason
 * `isLocale`/`toLocale` sit beside `LOCALES` instead of being retyped per caller. `input` and
 * `choice` were added for `FormSelect` (26 Aug 2026), `toggle` for `FormCheckbox` (4 Sep 2026),
 * and `FormCombobox`, `FormMultiSelect`, `FormSwitch` and `FormDate` each read one instead of
 * re-deriving it.
 *
 * **`toggle` deliberately does not take the `?? ''` below.** On a checkbox that coercion would put
 * an empty string where React expects a boolean, which renders an unchecked box that never
 * changes — the exact silent-wrong-answer shape the "both are spread" paragraph warns about.
 *
 * **Both are spread, never picked apart at the call site.** `field` carries a `ref`, and the
 * React Compiler's refs rule correctly refuses `input.ref` in a render body; more to the point, a
 * JSX spread does not check excess properties, so a control wired field-by-field can silently
 * drop the one it does not accept — a select that opens, renders and never reports a choice.
 * Handing the caller a complete, correctly-shaped object removes the chance to wire it wrong.
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
  const { onChange, ...rest } = field;

  // `?? ''` is load-bearing twice over. For a native input: with no `defaultValues` the first
  // render hands back `undefined`, and React then logs "changing an uncontrolled input to be
  // controlled" the moment someone types — an empty string is what an empty text input holds.
  // For a Radix control it is the same value by coincidence and by design: `''` is precisely what
  // that library reserves for "nothing chosen, show the placeholder", which is also why no
  // `SelectOption` may take it as a value.
  const value = field.value ?? '';

  return {
    id: fieldElementId({ scope, name }),
    error: fieldState.error?.message,
    /** A native input: `value` plus an event-shaped `onChange`. */
    input: { ...rest, onChange, value },
    /** A control that reports its own value — Radix `Select`, and its successors. */
    choice: { ...rest, onValueChange: onChange, value },
    /**
     * A native checkbox or switch: `checked` plus an event-shaped `onChange` that reports the
     * boolean rather than the event, so the stored value is what the control means.
     */
    toggle: {
      ...rest,
      checked: field.value === true,
      onChange: (event: { target: { checked: boolean } }) => onChange(event.target.checked),
    },
  };
}
