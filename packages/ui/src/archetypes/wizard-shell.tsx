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
 * **Drawn as the artboards draw it since task 179.1** (`design_spec.md` S-07's amendment of 30 Sep 2026): the bar in
 * the workspace tier's place, then the list — docked beside the step at `wide`, and below it at the narrower frames as
 * the caller's `compactModules`, a strip or a stepper — then the step. **The bar and the list stay in place and the step
 * scrolls**, as the workspace band does over its screens (§4.2): the shell fills the `(app)` layout's region exactly and
 * scrolls a region of its own, and the docked list scrolls within itself only on a window shorter than it.
 *
 * **The bar is required**, because it carries UX-5's way out — `WizardBar` makes its exit required in turn — so no
 * screen built on this shell can omit it.
 *
 * **No text and no router**, per the package rule: every string and every link arrives as a node.
 */
export interface WizardShellProps {
  /** `WizardBar` — the way out, the report, the save state, the actions. */
  bar: ReactNode;
  /** `WizardModuleGroup`s — the persistent module list, docked at `wide` (UX-5). */
  modules: ReactNode;
  /** Labels the module list for assistive technology; the app supplies the word. */
  modulesLabel: string;
  /** The list below `wide` — `WizardModuleSwitcher`. */
  compactModules?: ReactNode;
  /** The step header's own heading — the module in plain language beside its reference (UX-11). */
  title: ReactNode;
  /** How much of this step remains outstanding (UX-11). Rendered under the title. */
  progress?: ReactNode;
  /** S-08 beside the step content, simultaneously visible at `wide` (§3.3). */
  panel?: ReactNode;
  /** The step's fields. */
  children: ReactNode;
}

export function WizardShell({
  bar,
  modules,
  modulesLabel,
  compactModules,
  title,
  progress,
  panel,
  children,
}: WizardShellProps) {
  return (
    <div className={styles.shell}>
      {bar}
      {compactModules ? <div className={styles.compact}>{compactModules}</div> : null}

      <div className={styles.frame}>
        {/* `nav` rather than a list in a `div`: the module list IS this screen's navigation once the workspace tier is
            suppressed, and a screen reader that cannot find a landmark here has no way to move between steps except by
            reading the whole form. Drawn at `wide` only; below it the same steps are `compactModules`. */}
        <nav className={styles.rail} aria-label={modulesLabel}>
          {modules}
        </nav>

        <div className={styles.scroll}>
          {/*
            **`main`, not a `div` whose class happens to be called `main`** (UX-99, 9 Sep 2026). The rail beside it is
            this screen's `navigation`, and a class name that read like a landmark without being one left
            `getByRole('main')` finding nothing on S-07 … S-12 — a screen-reader user had chrome to skip and nothing to
            skip *to*. **The element wraps the step alone**: the rail and the bar stay outside, or a screen reader would
            find a `main` whose first content is the navigation it wanted to skip — the reason `(workspace)`'s layout
            puts `<main>` around only its children, and why the sibling archetypes, which render inside that layout,
            have none.
          */}
          <main className={styles.main}>
            <header className={styles.header}>
              <h1 className={styles.title}>{title}</h1>
              {progress ? <p className={styles.progress}>{progress}</p> : null}
            </header>

            <div className={styles.body}>
              <div className={styles.step}>{children}</div>
              {panel ? <aside className={styles.panel}>{panel}</aside> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
