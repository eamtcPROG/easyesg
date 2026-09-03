import type { ReactNode } from 'react';
import styles from './fieldset.module.css';

/**
 * Fieldset — §11.5's *Fieldset* form control, built for S-07's repeating groups (task 36.2).
 *
 * **Native `<fieldset>` and `<legend>`, which the Components artboard specifies by name**
 * (*"ui/form.tsx · native fieldset/legend"*). Nothing here reimplements what the element already
 * does: it exposes an accessible `group` whose name is the legend, and assistive technology
 * announces that name when focus enters the group — which is the whole reason five fields about
 * *one site* are a group rather than five fields in a row.
 *
 * **The legend does not join each control's accessible name**, and the first draft of this header
 * said it did. Accessible-name computation takes a control's own label; the legend names the
 * *group*, and containment is what carries the association. The distinction decides the label
 * inside: *City* is right, *City of site 1* would be the legend said twice.
 *
 * **Why it exists now.** Task 91.2 serves a typed axis — sites, subsidiaries — as one row per
 * ordinal, so B1's five site elements arrive five times over for a two-site undertaking, interleaved
 * in the standard's presentation order. Rendered flat, nothing says which city belongs to which
 * address; the artboards and §5's S-07 row are silent, so flat is what the plan would have produced
 * by default. §11.5 listed this control from the start and no screen had needed it (project owner,
 * 3 Sep 2026, `architecture.md` §12.5.6).
 *
 * **`action` is the group's own control, not the form's.** A repeating group needs a control beside
 * its legend — S-07 uses it for *add another row* — and a plain fieldset has nowhere to put one,
 * while a screen inventing that place is the UX-89 defect this component exists to prevent. It is
 * one slot rather than a named `onAdd`/`onRemove` pair, so the group does not have to know which
 * verb its consumer needs; *remove this row* has no consumer yet and is deliberately not modelled.
 *
 * **No text, no router, no colour of its own** — the package rule. The legend, the action and the
 * children are all nodes.
 *
 * States (§8.1 subset): rest, and **read-only**, which removes the affordance and keeps the group,
 * following `DisclosureField`'s own rule that read-only is not a greyed form. `disabled` is
 * deliberately absent: a locked period is read-only (UX-13), and a group nobody may edit still has
 * to be readable.
 */
export interface FieldsetProps {
  /** The group's name — *Site 1*, *Subsidiary 2*. Already in the reader's language. */
  legend: ReactNode;
  children: ReactNode;
  /**
   * A control the group offers, rendered beside the legend — *remove this row*. Omitted where the
   * group is not removable, and never rendered under `readOnly`.
   */
  action?: ReactNode;
  /** UX-13: the affordances go, the content stays. */
  readOnly?: boolean;
  className?: string;
}

export function Fieldset({ legend, children, action, readOnly = false, className }: FieldsetProps) {
  return (
    <fieldset className={[styles.fieldset, className].filter(Boolean).join(' ')}>
      <legend className={styles.legend}>{legend}</legend>
      {action && !readOnly ? <div className={styles.action}>{action}</div> : null}
      <div className={styles.fields}>{children}</div>
    </fieldset>
  );
}
