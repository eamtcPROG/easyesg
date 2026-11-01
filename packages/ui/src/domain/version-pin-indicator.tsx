'use client';

import type { ReactNode } from 'react';
import styles from './version-pin-indicator.module.css';
import { VERSION_PIN_STANDING } from './version-pin-indicator-vocabulary';

/**
 * Version pin indicator — §11.5's Domain row, defined in §6.9, and the **first component in this
 * folder** (task 32.1.1).
 *
 * It shows which taxonomy, template or factor-set version a record is pinned to. That is DR-4 made
 * visible: the pin is a dimension of the data, and task 32.3's deliverable says it plainly —
 * *"DR-4 is only checkable by a user if the pin is on the screen"*.
 *
 * **The version string is a reference code shown on purpose**, which is the narrow exception to
 * CLAUDE.md's user-facing-text rule: `2026-05-01` is EFRAG's own release identifier (OQ-45), the
 * thing a reader quotes to an auditor or to support. The *label* beside it is the caller's
 * localized words; this package renders text and owns none.
 *
 * States (§8.1): **success only** — a pin is a settled fact read from a record that has already
 * loaded, so it has no loading, empty, partial, offline or pending instance of its own; the screen
 * around it owns those. Read-only is its permanent condition rather than a state it enters, and it
 * has no error: a pin that could not be read is an absent record, which is the screen's error, not
 * this component's. The two *standings* below are not §8.1 states and do not discharge UX-90 —
 * that conflation is what the first version of this docblock made.
 *
 * ## Two standings, because UX-48 makes the second one refuse to be silent
 *
 * A pin is either in force or superseded. UX-48: *"Where a report is pinned to a superseded
 * taxonomy version, the dialogue shall offer migration or export-against-original with an explicit
 * notice, and shall not proceed silently."* A component that could only draw *in force* would make
 * that impossible to honour, and the state would be invented later by whichever screen met it
 * first — which is the UX-89 defect arriving one component late.
 *
 * **Only `IN_FORCE` is reachable today, and that is stated rather than discovered.** Nothing yet
 * tells a screen that a pin has been superseded: `TAXONOMY_REGISTRY.registeredVersions()` exists on
 * the API and no route publishes it, and task 33.3 is what registers a second version at all. The
 * superseded standing is built here per UX-8 and UX-90 — every applicable §8.1 state designed
 * before any instance — and its first real driver is task 33.3's.
 */
/**
 * **A discriminated union rather than two independent optionals**, corrected 31 Aug 2026 before
 * this shipped: the first version documented `standingLabel` as *"required when `standing` is
 * superseded"* and enforced it nowhere, so a superseded pin with no label compiled, rendered the
 * warning border, and named the state to nobody using a screen reader — the exact WCAG 1.4.1
 * failure the prose forbade. A rule a docstring asserts and a type permits is a rule the component
 * will eventually break itself.
 *
 * `note` stays optional on purpose. UX-48's *"shall not proceed silently"* binds the **export
 * dialogue** (§6.9), where there is something to proceed with; a pin shown beside a reporting
 * period is stating a fact, and requiring a notice there would put an alert on every locked year.
 */
export type VersionPinIndicatorProps = {
  /** What is pinned, in the caller's words — "Taxonomy version", "Digital Template". */
  label: ReactNode;
  /** The release identifier itself. Shown verbatim; a reader quotes this. */
  version: string;
  className?: string;
} & (
  | {
      /** Defaults to in force, which is the only standing anything can currently produce. */
      standing?: typeof VERSION_PIN_STANDING.IN_FORCE;
      /** Neither renders in force, so neither may be passed — a prop that is silently ignored is
       *  a caller believing something is on the screen. */
      standingLabel?: never;
      note?: never;
    }
  | {
      standing: typeof VERSION_PIN_STANDING.SUPERSEDED;
      /**
       * Names the standing for assistive technology. **Required, and now unrepresentably so**: the
       * visual difference is a border colour, and a state a sighted reader can see and a screen
       * reader cannot is not a state.
       */
      standingLabel: ReactNode;
      /** An explicit notice where the surface has something to refuse — localized, three-part. */
      note?: ReactNode;
    }
);

export function VersionPinIndicator({
  label,
  version,
  standing = VERSION_PIN_STANDING.IN_FORCE,
  note,
  standingLabel,
  className,
}: VersionPinIndicatorProps) {
  const superseded = standing === VERSION_PIN_STANDING.SUPERSEDED;

  return (
    // **`data-standing` rather than a conditional class**, corrected the same day: the standing was
    // carried by a CSS-module class nothing could assert, so deleting it left every test green
    // while the only signal a sighted reader gets disappeared. The attribute is one source of
    // truth — the stylesheet keys off it and a spec can read it.
    <div className={[styles.pin, className].filter(Boolean).join(' ')} data-standing={standing}>
      <span className={styles.line}>
        <span className={`t-label ${styles.label}`}>{label}</span>
        {/* Monospace and `translate="no"`: a release identifier is not prose, and a browser's
            page translation rewriting `2026-05-01` would rewrite the one thing a reader quotes. */}
        <span className={`t-code ${styles.version}`} translate="no">
          {version}
        </span>
        {superseded ? <span className={styles.standing}>{standingLabel}</span> : null}
      </span>
      {superseded && note ? <p className={`t-caption ${styles.note}`}>{note}</p> : null}
    </div>
  );
}
