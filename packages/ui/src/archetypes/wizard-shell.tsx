import type { ReactNode } from 'react';
import { WizardStepMark } from './wizard-step-mark';
import type { WizardStepState } from './wizard-step-vocabulary';
import styles from './wizard-shell.module.css';
import { MAIN_CONTENT_ID } from '../navigation/skip-link-vocabulary';

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
  /** Where the step stands in the report — *Module 1 of 11* — above the heading (task 179.3). */
  position?: ReactNode;
  /** What the module covers, one sentence under the heading (task 179.3). */
  summary?: ReactNode;
  /**
   * The step's state beside its heading (UX-11; task 179.3): the list's own state, its mark drawn from it, and its
   * words — *In progress · 3 outstanding* — with a line under them where the words leave something unsaid.
   */
  status?: { readonly state: WizardStepState; readonly words: ReactNode; readonly note?: ReactNode };
  /** S-08 beside the step content, simultaneously visible at `wide` (§3.3). */
  panel?: ReactNode;
  /** The step's fields. */
  children: ReactNode;
  /** Under the fields: the way to the module before and after (task 179.3). */
  foot?: ReactNode;
}

export function WizardShell({
  bar,
  modules,
  modulesLabel,
  compactModules,
  title,
  position,
  summary,
  status,
  panel,
  children,
  foot,
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
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
            {/* The Reporting Core frame's heading (task 179.3): the position, the name and what the module covers on one
                side, the state on the other — beside them while they fit, beneath them when they do not. */}
            <header className={styles.header}>
              <div className={styles.heading}>
                {position ? <p className={styles.position}>{position}</p> : null}
                <h1 className={styles.title}>{title}</h1>
                {summary ? <p className={styles.summary}>{summary}</p> : null}
              </div>
              {status ? (
                <div className={styles.status}>
                  <p className={styles.state} data-state={status.state}>
                    <WizardStepMark state={status.state} />
                    <span>{status.words}</span>
                  </p>
                  {status.note ? <p className={styles.note}>{status.note}</p> : null}
                </div>
              ) : null}
            </header>

            <div className={styles.body}>
              <div className={styles.step}>{children}</div>
              {panel ? <aside className={styles.panel}>{panel}</aside> : null}
            </div>

            {foot ? <div className={styles.foot}>{foot}</div> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
