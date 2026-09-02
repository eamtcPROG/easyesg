'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { TextField } from './text-field';

/**
 * Date input — §11.5's *Date* form control, first implemented for S-14 (task 32.1.1).
 *
 * **A native `<input type="date">` wearing `TextField`'s clothes**, and the deciding property is
 * not the picker but the *value*: a native date input reads back **ISO `YYYY-MM-DD` whatever the
 * display locale**, which is exactly what a `LegalDate`'s `date` half stores. So this control needs
 * no parsing, no locale table, and cannot disagree with the wire in one of three languages. Its
 * keyboard and screen-reader behaviour is the platform's, which is the cheapest route to NFR-75's
 * WCAG 2.2 AA on a control that would otherwise own the largest accessibility surface in the
 * inventory (`architecture.md` §12.5.6's task-32.1 row; the composed-calendar alternative is
 * declined there, with its cost).
 *
 * States (§8.1): **inherited from `TextField`** — rest, focus, filled, invalid, disabled — because
 * this renders that component and adds no branch of its own. Stated rather than omitted, per
 * UX-90's *"an undefined state is a defect, not an omission"*; `focus-column.tsx` is the precedent
 * for inheritance being an acceptable answer when it is written down.
 *
 * **Accepted cost, stated because it is visible:** the picker's own chrome cannot be fully styled,
 * so a screen using this will not match its artboard pixel for pixel.
 *
 * ## Why this exists rather than `<TextField type="date" />`
 *
 * Because the inventory says so — §11.5 lists Date as its own row, and UX-89 makes a need met by
 * the inventory the inventory's to meet. Concretely it buys three things a bare `type` prop does
 * not: `type` cannot be overridden away, so no instance can quietly become a text box; `min` and
 * `max` are typed as ISO strings, which is the only format the attribute accepts and the one a
 * caller holding a formatted date will get wrong; and the value contract below has somewhere to be
 * written down.
 *
 * ## The value is a bare ISO string, and the timezone is deliberately not here
 *
 * Every legal date this product stores is `{ date, timezone }` (NFR-34), and `LegalDateDto`'s own
 * comment says the pairing is an object *"so the zone cannot be forgotten"*. This control still
 * emits only the date half, because **`packages/ui` renders and owns no ambient facts**: the zone
 * is the reporter's browser (`architecture.md` §12.5.6's task-32.1 row), and a presentational
 * component reaching for `Intl` on the application's behalf would put an environment read inside
 * the one package that must stay renderable in a PDF worker with no DOM.
 *
 * The pairing therefore lives in one function in the consuming app, next to where the zone is
 * resolved — not repeated per field, which is the failure the DTO's object shape prevents on the
 * wire and which the app has to prevent on the screen.
 */
export interface DateFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'type' | 'min' | 'max'> {
  label: ReactNode;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id; also the anchor a `FormSummary` link targets. Auto-generated if omitted. */
  id?: string;
  /** ISO `YYYY-MM-DD`. The attribute accepts no other format, which is why it is typed apart. */
  min?: string;
  /** ISO `YYYY-MM-DD`. */
  max?: string;
  /** `TextField`'s rule: hidden visually, kept for assistive technology. */
  labelHidden?: boolean;
}

export function DateField({ label, help, error, id, labelHidden, ...input }: DateFieldProps) {
  return (
    <TextField
      {...input}
      type="date"
      label={label}
      labelHidden={labelHidden}
      help={help}
      error={error}
      id={id}
    />
  );
}
