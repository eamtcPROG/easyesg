import { Select } from '@easyesg/ui';
import styles from '../styles/step.module.css';

/**
 * UX-14's unit, in the anatomy's own slot: *"either fixed by the taxonomy or chosen from a
 * constrained list"* (task 91.4).
 *
 * **The two branches are `length`, not a flag** — one admitted code is a unit to show, several are a
 * list to ask from — and neither is free text, which UX-14 calls *"the primary source of unusable
 * ESG data"*. **No inventory addition**: `DisclosureField`'s `unit` slot is documented as taking
 * *"a fixed label or a constrained control"*, and the control is `Select` off the shelf, so UX-89's
 * test — a difference in **anatomy** — finds none.
 */
export function FieldUnit({
  admitted,
  chosen,
  readOnly,
  label,
  placeholder,
  nameOf,
  onChoose,
}: {
  readonly admitted: readonly string[];
  /** The unit in force, or `null` where several are admitted and nobody has chosen yet. */
  readonly chosen: string | null;
  readonly readOnly: boolean;
  readonly label: string;
  readonly placeholder: string;
  readonly nameOf: (code: string) => string;
  readonly onChoose: (code: string) => void;
}) {
  // One admitted unit is UX-14's *fixed by the taxonomy*: shown, never asked. Read-only takes the
  // same branch — UX-13 keeps the layout and removes the affordance.
  if (readOnly || admitted.length < 2) {
    return chosen === null ? null : <span className={styles.unit}>{nameOf(chosen)}</span>;
  }
  return (
    <Select
      label={label}
      labelHidden
      // **Empty until chosen** (project owner, 8 Sep 2026). `unitCodes` is not an order of
      // preference — EFRAG's own template pre-selects tonnes where the taxonomy lists kilogrammes
      // first — so a seeded value here would file a unit nobody picked, at a thousandfold error.
      placeholder={placeholder}
      value={chosen ?? undefined}
      onValueChange={onChoose}
      options={admitted.map((code) => ({ value: code, label: nameOf(code) }))}
    />
  );
}
