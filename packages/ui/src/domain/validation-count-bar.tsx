import { ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './validation-count-bar.module.css';

/**
 * S-08's permanent seat below `wide` (task 42.2) — *"because the panel cannot be docked …, the count bar takes its place
 * and stays visible while scrolling"* (*S-07/S-08 narrow*). A full-width control at the foot of the step, its words the
 * caller's — *4 must fix · 5 review* — that raises the panel as a sheet; the wizard is still behind it, and closing it
 * returns to the same place.
 *
 * **A button, whose accessible name is the caller's whole sentence**, so a screen reader hears what is outstanding and
 * that pressing opens it; the chevron is decoration. **Gone from `wide` up** (`display: none`), where the docked panel
 * shows the same counts — the two are never both in view or both announced.
 */
export interface ValidationCountBarProps {
  /** The counts, in words — the bar's whole name. */
  readonly children: ReactNode;
  readonly onOpen: () => void;
  /** Whether the sheet it raises is open, for assistive technology. */
  readonly expanded: boolean;
}

export function ValidationCountBar({ children, onOpen, expanded }: ValidationCountBarProps) {
  return (
    // `data-panel-seat` is what the Wizard shell keeps in view at the foot of the step below `wide` — the shell's own
    // stylesheet selects it, so a slot holding anything else (S-09's summary) keeps its place.
    <div className={styles.seat} data-panel-seat="">
      <button type="button" className={styles.bar} onClick={onOpen} aria-expanded={expanded} aria-haspopup="dialog">
        <span className={styles.words}>{children}</span>
        <ChevronUp className={styles.chevron} aria-hidden="true" />
      </button>
    </div>
  );
}
