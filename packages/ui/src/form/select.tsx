'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useId } from 'react';
import type { FocusEventHandler, ReactNode, Ref } from 'react';
import styles from './select.module.css';

/**
 * Select — §11.5 form control, and `TextField`'s anatomy with a fixed option set in place of free
 * entry: label · control · help text · inline state message.
 *
 * **Radix Select, not a native `<select>` — corrected 26 Aug 2026** (project owner, task 26.4's
 * component review). The first draft was native, arguing that a custom listbox would have to
 * reimplement keyboard behaviour, type-ahead and the screen-reader contract. `design/screens/EasyESG
 * Components.dc.html` — which §11.5 makes "the reference for anything ambiguous" — had already
 * answered that ("the library supplies behaviour, focus management and ARIA; the values here supply
 * the identity") and had already specified this entry as `ui/select.tsx (Radix Select)`. Three
 * things the native control cannot do, each independently decisive:
 *
 * - The sheet's Select specimen names three tier-3 tokens for the open menu — `menu.surface`,
 *   `menu.item.active`, `menu.item.selected`. An OS-drawn popup gives them no consumer at all.
 * - **UX-79** requires a whole-identity swap to edit tier 1 only, *verified* by building the
 *   MUD-approximating theme before launch. No tier reaches an OS popup, so that check could never
 *   pass here.
 * - This file is the base of **four** inventory entries — Select, Combobox, Multi-select, and the
 *   unit slot of Number-with-unit, which sits inside the disclosure field. The sheet's MUD note
 *   requires all four to share field metrics "so a themed build needs no layout change"; a native
 *   control's box belongs to the OS, not to us.
 *
 * **Options are data, not `children`.** The alternative is every screen writing `Select.Item` /
 * `Select.ItemText` / `Select.ItemIndicator` itself, which spreads the primitive's anatomy across
 * the app and re-creates the one-off-component defect UX-89 names, in a shape that looks like
 * composition. `label` is a `string` on purpose: `Select.Value` echoes the chosen item's text into
 * the trigger, so a rich node there would render twice — the second line belongs in `description`,
 * which is the sheet's own NACE anatomy (`10.71` · *Manufacture of bread*) and the reason a fixed
 * option set can now explain itself while being chosen.
 *
 * Two properties of the primitive worth knowing before you call it:
 *
 * - **`value` may never be the empty string.** Radix reserves `''` to mean "reset to the
 *   placeholder", and an item that uses it throws. A filter's "all" row therefore needs a real
 *   member of its own vocabulary, which the closed-vocabulary rule wanted anyway.
 * - **The menu is portalled to `document.body`**, so it escapes the `overflow` of a scrolling table
 *   — the near-term caller. The cost is that `body` is not the top layer: inside a native modal
 *   `<dialog>` (`ConsequenceDialogue`) the menu would render *behind* the backdrop. No screen does
 *   that yet; UX-47's export dialogue will, and is the point at which this is decided rather than
 *   discovered.
 *
 * States (§8.1 subset): rest — on `--field-border-rest`, because a field must look enterable —
 * focus · filled · invalid · disabled, plus the menu's own open/active/selected. Help and error are
 * wired through `aria-describedby`, invalidity through `aria-invalid`, and the stable error id is
 * what UX-111's summary deep-links to; `id` lands on the trigger, because that is what takes focus.
 */
export interface SelectOption {
  /** Never `''` — Radix reserves it for the placeholder reset, and an item using it throws. */
  readonly value: string;
  /** One line, localized by the caller. Echoed into the trigger once chosen. */
  readonly label: string;
  /** The second line, shown only in the open menu — what choosing this actually means. */
  readonly description?: ReactNode;
  /** Unselectable but still announced. Say why in `description`; a dead end without one is not a choice. */
  readonly disabled?: boolean;
}

export interface SelectProps {
  label: ReactNode;
  options: readonly SelectOption[];
  /** Uncontrolled — the initial choice, and what a `<form>` submits untouched. */
  defaultValue?: string;
  /** Controlled. Supply `onValueChange` with it. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Submitted with the enclosing form; Radix renders the hidden input that carries it. */
  name?: string;
  /** Shown until something is chosen. Never a restatement of the label (UX-110). */
  placeholder?: ReactNode;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id; also the anchor a FormErrorSummary link targets. Auto-generated if omitted. */
  id?: string;
  /** Hides the label visually while keeping it for assistive technology — for a control whose
   *  column header already names it, as in a table row. The label is never simply omitted. */
  labelHidden?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /**
   * Forwarded to the **trigger** — the focusable element, and the one `#id` addresses. React 19
   * takes `ref` as an ordinary prop, so no `forwardRef` is involved.
   *
   * It exists for one caller: `@easyesg/ui/forms`. react-hook-form's `shouldFocusError` moves
   * focus to the first field that failed on a rejected submit, and it does that through the ref —
   * so without this, a select could be the reason a form refused while focus stayed where it was.
   */
  ref?: Ref<HTMLButtonElement>;
  /** Also the trigger's. What marks the field touched under `mode: 'onBlur'`. */
  onBlur?: FocusEventHandler<HTMLButtonElement>;
}

export function Select({
  label,
  options,
  defaultValue,
  value,
  onValueChange,
  name,
  placeholder,
  help,
  error,
  id,
  labelHidden = false,
  disabled,
  required,
  className,
  ref,
  onBlur,
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const description =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        htmlFor={fieldId}
        className={labelHidden ? styles.labelHidden : `t-label ${styles.label}`}
      >
        {label}
      </label>

      <SelectPrimitive.Root
        defaultValue={defaultValue}
        value={value}
        onValueChange={onValueChange}
        name={name}
        disabled={disabled}
        required={required}
      >
        <SelectPrimitive.Trigger
          id={fieldId}
          ref={ref}
          onBlur={onBlur}
          className={`${styles.trigger} ${error ? styles.invalid : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          {/* Decorative: the trigger already announces itself as a listbox, and the glyph is
              redundant emphasis (UX-102). */}
          <SelectPrimitive.Icon className={styles.chevron}>
            <ChevronDown aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className={styles.menu} position="popper" sideOffset={4}>
            <SelectPrimitive.Viewport className={styles.viewport}>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={styles.item}
                >
                  <span className={styles.itemBody}>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    {option.description ? (
                      <span className={`t-caption ${styles.itemDescription}`}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {/* The chosen row is marked, not merely tinted: with a description present the
                      highlight reads as hover, and §6.4's rule against colour as sole carrier
                      applies to a menu as much as to a disclosure state. */}
                  <SelectPrimitive.ItemIndicator className={styles.itemIndicator}>
                    <Check aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {help ? (
        <p id={helpId} className={`t-caption ${styles.help}`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={`t-caption ${styles.error}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
