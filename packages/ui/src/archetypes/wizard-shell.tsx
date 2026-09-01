import type { ReactNode } from 'react';
import styles from './wizard-shell.module.css';

/**
 * Wizard archetype (§4.6) — *"ordered progression with completion state"*: S-07, S-09, S-19.
 *
 * **Extracted at the first Wizard**, the precedent `IndexShell` and `RecordShell` set. S-09 is a
 * *composition* of this rather than an archetype of its own (§4.6, OQ-7 closed 18 Aug 2026), so it
 * inherits this state set and defines none.
 *
 * **The module list replaces the workspace tier rather than sitting beside it** (UX-5). That is the
 * archetype's distinguishing structure, not a layout preference: inside a report the only
 * navigational choice is *which module*, and leaving the workspace navigation visible would offer
 * a reporter three ways out of a form they are told is saving continuously.
 *
 * **The exit control is a fixture, not a slot.** UX-5 requires it be single, always visible and
 * explicitly labelled — a screen that could omit it would be a screen that traps someone in a
 * wizard, so the prop is required and the shell renders it in one place. `saveState` is beside it
 * for UX-35's *"one fixed location"*, and is a slot only because S-09's sub-flows inherit the shell
 * without owning the report's save state.
 *
 * **No text and no router**, per the package rule: every string and every link arrives as a node.
 * The rail's items are the app's own `Link`s wrapped in `WizardModuleItem`, which is what keeps
 * `packages/ui` out of `next/navigation` and reusable by the admin console.
 */
export interface WizardShellProps {
  /** `WizardModuleItem`s — the persistent module list (UX-5). */
  modules: ReactNode;
  /** Labels the module list for assistive technology; the app supplies the word. */
  modulesLabel: string;
  /** The step header's own heading — the module in plain language beside its reference (UX-11). */
  title: ReactNode;
  /** How much of this step remains outstanding (UX-11). Rendered under the title. */
  progress?: ReactNode;
  /** UX-35's save-state indicator, in the one fixed location this shell gives it. */
  saveState?: ReactNode;
  /** UX-5's single, always-visible, explicitly labelled way out. Required by construction. */
  exit: ReactNode;
  /** S-08 beside the step content, simultaneously visible at `wide` (§3.3). */
  panel?: ReactNode;
  /** The step's fields. */
  children: ReactNode;
}

export function WizardShell({
  modules,
  modulesLabel,
  title,
  progress,
  saveState,
  exit,
  panel,
  children,
}: WizardShellProps) {
  return (
    <div className={styles.shell}>
      {/* `nav` rather than a list in a `div`: the module rail IS this screen's navigation once the
          workspace tier is suppressed, and a screen reader that cannot find a landmark here has no
          way to move between steps except by reading the whole form. */}
      <nav className={styles.rail} aria-label={modulesLabel}>
        <ol className={styles.modules}>{modules}</ol>
      </nav>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {progress ? <p className={styles.progress}>{progress}</p> : null}
          </div>
          {/* One fixed location for both, so the indicator does not move as a step's content
              changes height — UX-35 is about the location as much as the four states. */}
          <div className={styles.controls}>
            {saveState}
            {exit}
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.step}>{children}</div>
          {panel ? <aside className={styles.panel}>{panel}</aside> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One module in the rail.
 *
 * **`current` drives `aria-current="step"`, not just a colour.** The Wizard's whole subject is
 * position in an ordered progression, and a rail that showed position only visually would leave a
 * screen-reader user unable to tell which of eleven modules they are in — a WCAG 2.2 AA failure that
 * renders identically (NFR-75).
 *
 * **The link is the caller's**, so this stays out of the router. The app passes its `Link`; this
 * owns the list item, the state and the indicator's placement.
 */
export interface WizardModuleItemProps {
  /** The app's own link to this step. */
  children: ReactNode;
  current?: boolean;
  /** The per-module state indicator UX-5 requires the list to carry. */
  indicator?: ReactNode;
}

export function WizardModuleItem({ children, current = false, indicator }: WizardModuleItemProps) {
  return (
    <li className={styles.module} aria-current={current ? 'step' : undefined}>
      <span className={current ? styles.moduleCurrent : styles.moduleLink}>{children}</span>
      {indicator ? <span className={styles.indicator}>{indicator}</span> : null}
    </li>
  );
}
