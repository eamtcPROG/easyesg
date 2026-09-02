import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './disclosure-field.module.css';

/**
 * Disclosure field — §11.5's *"atomic unit; every variant shares one anatomy"*, and §6.2's only
 * screen-level layout diagram, which makes that anatomy normative rather than suggested.
 *
 * ```
 * Label (plain language)                          [state marker]
 * Help text — one or two sentences, plain language
 * [ value input ] [ unit ]        ← unit fixed or chosen, never free
 * Prior period: 1 240 MWh · [Carry forward]
 * ⓘ state message: what / consequence / action
 * [Mark not available ▾]          ← always present
 * ⌄ Why this is asked · standard reference · example
 * ```
 *
 * **The input is a slot, and that is what "every variant shares one anatomy" means.** Ten disclosure
 * kinds answer into four typed columns, so the *control* differs per kind while the label, marker,
 * help, unit, comparative, message, not-available declaration and progressive disclosure do not.
 * Building the anatomy per module is the defect UX-89 names, and 36.1's own row says why it bites
 * hardest here: eleven modules copying a bespoke field would copy eleven omissions.
 *
 * **`notAvailable` is a required prop, not an optional one.** UX-15: the declaration is *"a
 * first-class action, not an alternative discovered after failing to answer"* — so a field that
 * could omit it would be a field that hides the only honest answer to a question the reporter cannot
 * answer. `unit` is optional because UX-14 binds quantitative fields only.
 *
 * **`help` is required for the same kind of reason.** UX-17 puts one to two sentences visible by
 * default and says *"the user shall never have to open anything to answer a normal question"*. An
 * optional prop would make the omission invisible; a required one makes it a decision.
 *
 * **No text, no router, no colour of its own** (the package rule, and UX-80). Every string arrives as
 * a node and every colour comes from a semantic token, which is what makes the dark scheme task 82
 * adds reach this component without it being touched — that is the whole of what a "dark map" means
 * for a component whose cascade has not gained one yet.
 */

/**
 * The seven tones the token cascade defines (`--state-ok` … `--state-neutral`).
 *
 * **A tone rather than a disclosure state, deliberately.** The store's states — missing, ok,
 * inconsistency, error, invalid_url, not_available, not_material, nil_return — are persistence
 * vocabulary owned by `apps/api`, and `packages/ui` has no workspace dependencies at all: its values
 * feed the print layer and the email renderer too (UX-127), so pulling a model in for eight strings
 * would put it in every consumer's graph. Mapping a stored state to a tone is the app's job; the
 * design system owns how a tone looks.
 */
export const FIELD_TONE = {
  OK: 'ok',
  ATTENTION: 'attention',
  WARNING: 'warning',
  ERROR: 'error',
  REASONED: 'reasoned',
  PENDING: 'pending',
  NEUTRAL: 'neutral',
} as const;

export type FieldTone = (typeof FIELD_TONE)[keyof typeof FIELD_TONE];

export interface DisclosureFieldProps {
  /** Plain language, never the taxonomy element key (CLAUDE.md's user-facing-text rule). */
  label: ReactNode;
  /** UX-17: one to two sentences, visible by default. Required so an omission is a decision. */
  help: ReactNode;
  /** The state marker beside the label — the caller's words, in one of the seven tones. */
  marker?: ReactNode;
  markerTone?: FieldTone;
  /** The control for this kind: `TextField`, `Select`, `DateField`, a textarea, a checkbox. */
  children: ReactNode;
  /** UX-14: fixed by the taxonomy or chosen from a constrained list. Never a free-text input. */
  unit?: ReactNode;
  /** UX-31 / FR-46: last year's value beside this year's input, where a prior period exists. */
  priorPeriod?: ReactNode;
  /** FR-47's per-field carry-forward, beside the comparative it would copy. */
  carryForward?: ReactNode;
  /** NFR-79's three parts — what happened, what it means, what to do — already localized. */
  message?: ReactNode;
  messageTone?: FieldTone;
  /** UX-15's always-present declaration. Required by construction. */
  notAvailable: ReactNode;
  /** UX-17's progressive disclosure: rationale, standard reference, worked example. */
  moreLabel?: string;
  more?: ReactNode;
  /** Read-only (UX-13) removes the affordances and keeps the layout, rather than greying a form. */
  readOnly?: boolean;
  /**
   * The id of the visible label, so the control inside can point `aria-labelledby` at it and the
   * question's words are the input's programmatic name (UX-110) without being rendered twice.
   * Auto-generated if omitted.
   */
  labelId?: string;
}

export function DisclosureField({
  label,
  help,
  marker,
  markerTone = FIELD_TONE.NEUTRAL,
  children,
  unit,
  priorPeriod,
  carryForward,
  message,
  messageTone = FIELD_TONE.NEUTRAL,
  notAvailable,
  moreLabel,
  more,
  readOnly = false,
  labelId,
}: DisclosureFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const labelElementId = labelId ?? `${id}-label`;

  return (
    // `group` with an accessible name, so a screen reader announces which disclosure it is inside
    // when the input, the unit and the carry-forward control are three separate stops. Without it a
    // reporter tabbing through forty fields hears three unattached controls per question.
    <section className={styles.field} role="group" aria-labelledby={labelElementId}>
      <div className={styles.head}>
        <span className={styles.label} id={labelElementId}>
          {label}
        </span>
        {marker ? (
          <span className={styles.marker} data-tone={markerTone}>
            {marker}
          </span>
        ) : null}
      </div>

      <p className={styles.help}>{help}</p>

      <div className={styles.entry}>
        <div className={styles.control}>{children}</div>
        {/* UX-14's unit sits beside the value and is never a free-text box — the caller passes a
            fixed label or a constrained control, and this only gives it its place. */}
        {unit ? <div className={styles.unit}>{unit}</div> : null}
      </div>

      {priorPeriod ? (
        <p className={styles.prior}>
          {priorPeriod}
          {carryForward && !readOnly ? <span className={styles.carry}>{carryForward}</span> : null}
        </p>
      ) : null}

      {message ? (
        // `role="status"` rather than `alert`: a field-level verdict is not an interruption, and
        // forty alerts on one step would make the step unusable with a screen reader.
        <p className={styles.message} id={messageId} data-tone={messageTone} role="status">
          {message}
        </p>
      ) : null}

      {/* UX-13: read-only keeps the layout and removes the affordance, rather than rendering a
          disabled control that looks like a field someone failed to fill in. */}
      {readOnly ? null : <div className={styles.declare}>{notAvailable}</div>}

      {more ? (
        <details className={styles.more}>
          <summary className={styles.moreSummary}>{moreLabel}</summary>
          <div className={styles.moreBody}>{more}</div>
        </details>
      ) : null}
    </section>
  );
}
