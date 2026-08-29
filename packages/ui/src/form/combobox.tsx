'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useMemo, useRef, useState } from 'react';
import type { FocusEventHandler, KeyboardEvent, ReactNode, Ref } from 'react';
import { Spinner } from '../primitives/spinner';
import styles from './combobox.module.css';

/**
 * Combobox — §11.5's Form-controls entry, built with task 30.4.1 for S-13's activity picker.
 *
 * **`Select`'s anatomy with a search box in place of a fixed list**: label · control · help text ·
 * inline state message, and options carrying `label` plus an optional `description` — which is the
 * sheet's own NACE shape (`10.71` · *Manufacture of bread*) and the reason a chosen code can
 * explain itself.
 *
 * **The options come from the caller and this component never filters them.** That is the
 * difference from `Select` and the whole reason a separate entry exists: CAEM Rev.2 is 996 entries
 * in three languages, so the search runs server-side (`GET /entities/nace-codes`) and this reports
 * what the reader typed through `onQueryChange`. A version that filtered a list it was handed would
 * work beautifully for twenty options and be unusable for the one screen it was built for.
 *
 * **Radix publishes no combobox**, so this composes `Popover` — §11.5's rule is that the reference
 * sheet's library column binds only where Radix is named, and here it names none. What Popover
 * supplies is the part worth not rewriting: portalling out of a scrolling ancestor, collision
 * handling, and outside-dismiss. `onOpenAutoFocus` is prevented because focus must stay in the
 * input; a combobox whose popup steals focus is a combobox that cannot be typed into.
 *
 * **The ARIA is the combobox pattern and not an approximation of it.** The input carries
 * `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is a
 * `listbox` of `option`s; the active option is *pointed at* rather than focused, so the caret never
 * leaves the text the reader is editing. Every one of those is load-bearing — drop
 * `aria-activedescendant` and a screen reader announces nothing as the reader arrows through.
 *
 * **This is the single-select control.** §11.5 lists Multi-select separately and it stays unbuilt:
 * FR-17's *NACE code(s)* is a list, and S-13 composes it by adding one code at a time to a set it
 * renders — which is a screen's arrangement of a control, not a second control. Building both at
 * once would ship an inventory entry with no consumer.
 *
 * States (§8.1 subset, all applicable): rest — on `--field-border-rest`, because a field must look
 * enterable · hover · focus, the two-layer ring · open · **loading**, while the caller is fetching,
 * with the list still readable rather than blanked (§8.1's *loading — refresh*) · **empty**, which
 * distinguishes *nothing matches* from *nothing typed yet* and is why there are two strings for it
 * · selected, marked by a tick and not by colour alone (UX-102) · invalid · disabled · read-only,
 * which is the disabled input carrying its value rather than an absent control.
 */
/**
 * The keys this control reads, as an `as const` — the convention applies to a `KeyboardEvent.key`
 * exactly as it applies to a status or a mode, and for its own reason rather than by analogy: a
 * typo'd `'ArowDown'` does not error, the comparison is simply false, and the arrow key silently
 * stops working. Declared here and unexported, because no other file compares against them.
 */
const KEY = {
  ARROW_DOWN: 'ArrowDown',
  ARROW_UP: 'ArrowUp',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
} as const;

export interface ComboboxOption {
  /** The key that gets stored. Never the empty string — that is this control's "nothing chosen". */
  readonly value: string;
  /** What the reader recognises. A string, because it is echoed into the input when chosen. */
  readonly label: string;
  /** The second line — the sheet's NACE anatomy. Optional, and never the only carrier of meaning. */
  readonly description?: string;
}

export interface ComboboxProps {
  id?: string;
  label: ReactNode;
  /** Visually hidden but present for assistive technology, as `Select`'s is. */
  labelHidden?: boolean;
  help?: ReactNode;
  /** The inline state message. Its presence is what marks the field invalid. */
  error?: ReactNode;
  /** The chosen option's value, or `''` for nothing chosen. */
  value: string;
  onValueChange: (value: string) => void;
  /** What the reader has typed. Controlled, so the caller can debounce and fetch against it. */
  query: string;
  onQueryChange: (query: string) => void;
  /** What the caller currently has for this query. Rendered as given, in the order given. */
  options: readonly ComboboxOption[];
  /** True while the caller is fetching. The list stays readable underneath. */
  loading?: boolean;
  /** Shown when nothing has been typed — the prompt, not an error. */
  promptLabel: string;
  /** Shown when something has been typed and nothing matched. */
  emptyLabel: string;
  /** Accessible name for the busy indicator, since it is not the sole carrier of anything. */
  loadingLabel: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export function Combobox({
  id,
  label,
  labelHidden = false,
  help,
  error,
  value,
  onValueChange,
  query,
  onQueryChange,
  options,
  loading = false,
  promptLabel,
  emptyLabel,
  loadingLabel,
  placeholder,
  disabled = false,
  name,
  ref,
  onBlur,
}: ComboboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listId = `${fieldId}-list`;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  // The chosen option, when the caller still has it in view. It may not: a reader who selects a
  // code and then types a new query has a value the current page does not contain, and the tick
  // simply does not show. Deriving it rather than storing it is what keeps those two consistent.
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const activeId = options[activeIndex] ? `${fieldId}-option-${activeIndex}` : undefined;

  const choose = (option: ComboboxOption): void => {
    onValueChange(option.value);
    // The label goes into the input, which is what makes the control read as *chosen* rather than
    // as a search box that happens to have fired something.
    onQueryChange(option.label);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === KEY.ARROW_DOWN || event.key === KEY.ARROW_UP) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === KEY.ARROW_DOWN ? 1 : -1;
      // Wraps, because a list a reader cannot get back to the top of is one they scroll twice.
      setActiveIndex((index) => (index + step + options.length) % Math.max(options.length, 1));
      return;
    }
    if (event.key === KEY.ENTER && open) {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        choose(option);
      }
      return;
    }
    if (event.key === KEY.ESCAPE && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={styles.field}>
      <label
        htmlFor={fieldId}
        className={`t-label ${styles.label} ${labelHidden ? styles.labelHidden : ''}`}
      >
        {label}
      </label>

      <Popover.Root open={open} onOpenChange={setOpen}>
        {/* The anchor is the box, so the list lines up with the field rather than with the input's
            text box — which differ once the control carries a chevron. */}
        <Popover.Anchor asChild>
          <div className={`${styles.control} ${error ? styles.invalid : ''}`}>
            <input
              id={fieldId}
              name={name}
              ref={(node) => {
                inputRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              }}
              className={styles.input}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open ? activeId : undefined}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              disabled={disabled}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setActiveIndex(0);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(true)}
              // **`onClick` as well as `onFocus`, and it is not redundant.** After choosing, focus
              // is still in the input — so a reader who clicks the field to change their mind fires
              // no focus event and the list stays shut. Found by the spec below, which is the only
              // thing that could: on screen it looks like a control that ignores a click.
              onClick={() => setOpen(true)}
              onBlur={onBlur}
            />
            {/* `Spinner` is decorative by its own contract — "the *container* names the wait" — so
                the name lives here, in a polite live region, and is announced when the fetch
                starts rather than being a tooltip nobody hears. */}
            <span className={styles.busy} role="status" aria-live="polite">
              {loading ? (
                <>
                  <Spinner />
                  <span className={styles.labelHidden}>{loadingLabel}</span>
                </>
              ) : null}
            </span>
            <ChevronDown aria-hidden="true" className={styles.chevron} />
          </div>
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            className={styles.list}
            align="start"
            sideOffset={4}
            // Focus must stay where the reader is typing. Without this the popup takes it on open
            // and the next keystroke goes nowhere — the failure that makes a combobox unusable.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <ul id={listId} role="listbox" aria-label={typeof label === 'string' ? label : undefined}>
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${fieldId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === activeIndex || undefined}
                  className={styles.option}
                  // `onMouseDown` rather than `onClick`: a click would blur the input first, and a
                  // blur that closes the list removes the row before its own click lands.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.description ? (
                      <span className={`t-caption ${styles.optionDescription}`}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <Check aria-hidden="true" className={styles.tick} />
                  ) : null}
                </li>
              ))}

              {/* Two empty states, not one. "Nothing typed yet" is a prompt and "nothing matched"
                  is an answer, and a control that says the same thing for both teaches the reader
                  their search is broken when they have not made one. */}
              {options.length === 0 ? (
                <li className={`t-caption ${styles.empty}`} role="presentation">
                  {query.trim().length === 0 ? promptLabel : emptyLabel}
                </li>
              ) : null}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {help ? (
        <p id={helpId} className={`t-caption ${styles.help}`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={`t-caption ${styles.error}`}>
          {error}
        </p>
      ) : null}

      {/* The chosen option's second line, kept under the field once the list is closed — otherwise
          choosing a code discards the words that explained it. */}
      {!open && selected?.description ? (
        <p className={`t-caption ${styles.selectedDescription}`}>{selected.description}</p>
      ) : null}
    </div>
  );
}
