import type { ReactNode } from 'react';
import { BackArrow } from '../navigation/back-arrow';
import type { NavLinkComponent } from '../navigation/nav-link';
import styles from './wizard-bar.module.css';

/**
 * The Wizard's bar — the tier that stands in the workspace tier's place inside a report, as `EasyESG Reporting
 * Screens.dc.html` draws it on every step (task 179.1): the way out, what is open, whether it is saved, and what can be
 * done with it.
 *
 * **The way out is a fixture, not a slot.** UX-5 requires a single, always-visible, explicitly labelled exit, so
 * `back` is required and drawn in one place: `BackArrow`, the square S-13 and S-14 draw, whose name is the caller's
 * sentence — the wizard's says that the work is saved. A screen that could omit it would be one that traps a reader.
 *
 * **The title is not a heading**: the step's is the page's one `<h1>` (UX-11), and the bar names the report the step
 * belongs to. **`actions` from `medium` up, `overflow` at `compact` in their place** — the artboard's ⋯ menu — so the
 * same actions are never offered twice at one width.
 *
 * **No text and no router**, the package rule: every word arrives as a node or a string, and the router and any guard
 * on leaving arrive as the injected link.
 *
 * States (§8.1, the applicable subset): rest; the arrow's hover and focus; without actions.
 */
export interface WizardBarProps {
  /** UX-5's way out. `label` is what a screen reader hears for the arrow. */
  readonly back: { readonly href: string; readonly label: string };
  /** The app's link for the arrow — one that asks before leaving unsent work, where there is some. */
  readonly linkComponent?: NavLinkComponent;
  /** *VSME 2025 — Basic Module*. */
  readonly title: ReactNode;
  /** *Brutăria Lina SRL · 1 January – 31 December 2025 · In progress*. */
  readonly meta?: ReactNode;
  /** UX-35's indicator, in the one fixed location the Wizard gives it. */
  readonly saveState?: ReactNode;
  /** What can be done with the report, from `medium` up. */
  readonly actions?: ReactNode;
  /** The same actions at `compact`, behind the ⋯ the artboard draws. */
  readonly overflow?: ReactNode;
}

export function WizardBar({ back, linkComponent, title, meta, saveState, actions, overflow }: WizardBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.identity}>
        <BackArrow href={back.href} label={back.label} linkComponent={linkComponent} />
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          {meta ? <p className={styles.meta}>{meta}</p> : null}
        </div>
      </div>
      <div className={styles.controls}>
        {saveState}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
        {overflow ? <div className={styles.overflow}>{overflow}</div> : null}
      </div>
    </div>
  );
}
