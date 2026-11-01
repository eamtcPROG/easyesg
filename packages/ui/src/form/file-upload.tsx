'use client';

import { useId, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import styles from './file-upload.module.css';

/**
 * File upload — §11.5's form control, *"composed dropzone"* in the Components sheet, built at its first consumer:
 * S-09's spreadsheet import (task 204.2; FR-211). Like the Radio group before it, the row catching up rather than a
 * new one.
 *
 * **A real `<input type="file">`, visually hidden, under a label that is the whole zone.** The platform control is
 * what opens the system's file dialogue, takes Enter and Space, and is announced as a file chooser; the zone is its
 * label, so a click anywhere in it opens the dialogue and its words are the input's accessible name. Nothing here
 * reimplements a button that would have to forward a click to a hidden input. The input sits *before* the zone so its
 * focus ring can be drawn on the zone (`.input:focus-visible + .zone`), replaced and never removed (`tokens.css`).
 *
 * **A file held over the zone and dropped is the same choice as one picked**, and both reach `onFile` with one file:
 * the zone takes one, and a second in the same drop is not a choice anyone made. **`accept` filters the dialogue and
 * nothing else** — a drop ignores it, so whether a file is one the screen can use is the caller's to say, and it says
 * it through `error`.
 *
 * **The input forgets each choice once it is handed over**, so choosing the same file again — after correcting it on
 * disk — is a new choice rather than no change.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · active (a file held over it) · invalid · disabled.
 * Loading, empty and success are the screen's: this control reports a choice and holds no file. Directive: the
 * active state is this control's own, a hook.
 */
export interface FileUploadProps {
  /** What to drop here — the zone's first line, and the chooser's accessible name with the hint. */
  readonly label: ReactNode;
  /** Which files, and how large — the second line. */
  readonly hint: ReactNode;
  /** The word saying the zone can be pressed too, drawn as a link reads. */
  readonly browse: ReactNode;
  /** What the system dialogue offers, as the input's `accept`. A filter, not a check. */
  readonly accept?: string;
  /** One file, chosen or dropped. */
  readonly onFile: (file: File) => void;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  /** Stable id for the input; auto-generated if omitted. */
  readonly id?: string;
}

export function FileUpload({ label, hint, browse, accept, onFile, error, disabled = false, id }: FileUploadProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [active, setActive] = useState(false);

  const hold = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) return;
    // Without this the browser opens the dropped file in the tab, and the drop never fires.
    event.preventDefault();
    setActive(true);
  };
  const leave = (event: DragEvent<HTMLLabelElement>) => {
    // Moving between the zone's own lines fires a leave on the zone; only leaving the zone itself ends the hold.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false);
  };
  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setActive(false);
    const file = disabled ? undefined : event.dataTransfer.files[0];
    if (file !== undefined) onFile(file);
  };

  return (
    <div className={styles.field}>
      <input
        id={inputId}
        type="file"
        className={styles.input}
        accept={accept}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file !== undefined) onFile(file);
        }}
      />
      <label
        htmlFor={inputId}
        className={error ? `${styles.zone} ${styles.invalid}` : styles.zone}
        data-active={active ? '' : undefined}
        onDragEnter={hold}
        onDragOver={hold}
        onDragLeave={leave}
        onDrop={drop}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>
          {hint}
          <span className={styles.browse}>{browse}</span>
        </span>
      </label>
      {error ? (
        <p id={errorId} className={`t-caption ${styles.error}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
