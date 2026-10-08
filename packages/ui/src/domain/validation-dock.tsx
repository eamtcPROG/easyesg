import type { ReactNode } from 'react';
import styles from './validation-dock.module.css';

/**
 * Where S-08 is docked: beside the step from the width at which the Wizard shell sets them side by side, and nowhere
 * below it (task 42.2; `design_spec.md` S-07, §3.3 — *simultaneously visible at `wide`*). **Kept in view while the
 * step scrolls** — the Panel archetype's *retains position* — and scrolling on its own where it is taller than the
 * window.
 *
 * **A part of its own rather than a breakpoint inside the panel**, because the same panel is raised as a sheet below
 * `wide` (`ValidationCountBar`), where hiding it would hide the sheet's content too. Below `wide` the dock leaves the
 * accessibility tree (`display: none`), so the panel is announced once, wherever it is.
 */
export function ValidationDock({ children }: { readonly children: ReactNode }) {
  return <div className={styles.dock}>{children}</div>;
}
