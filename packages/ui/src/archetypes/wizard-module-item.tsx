import type { ReactNode } from 'react';
import { Anchor, type NavLinkComponent } from '../navigation/nav-link';
import { ARIA_CURRENT } from '../navigation/nav-link-vocabulary';
import { WizardStepMark } from './wizard-step-mark';
import type { WizardStepState } from './wizard-step-vocabulary';
import styles from './wizard-module-item.module.css';

/**
 * One step in the Wizard step list — the Reporting Core rail's row (task 179.1): the state's mark, then the step's
 * name as the link, then a line in words saying where it stands.
 *
 * **`current` drives `aria-current="step"`, on the anchor.** The Wizard's whole subject is position in an ordered
 * progression, and a rail that showed position only visually would leave a screen-reader user unable to tell which
 * module they are in (NFR-75). Task 106 moved the attribute from the `<li>` to the anchor, because an ancestor's
 * `aria-current` is not announced to a reader moving link-to-link, which is how anyone crosses the list — so this
 * builds the anchor, with the router injected through `linkComponent`, and the package still holds no router.
 *
 * **The line is the link's description, not part of its name.** A link called *B1 — Basis for preparation In progress
 * · 3 outstanding* would be a different link every time a field is answered. So the name is the label alone, the line
 * reaches a screen reader as `aria-description` on the same anchor, and the visible copy of it is hidden from
 * assistive technology so a reader in browse mode does not hear it twice.
 *
 * **The whole row is the target**: the anchor's `::after` covers it, so the mark and the line are clickable too, as the
 * padded box has been since task 106 made the anchor the styled element.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · current, and each step state of `WIZARD_STEP_STATE`,
 * drawn by its mark and named by its line.
 */
export interface WizardModuleItemProps {
  /** The step's address. */
  readonly href: string;
  /** The step's name as the reader sees it — *B1 — Basis for preparation*. Localized by the caller. */
  readonly label: ReactNode;
  readonly state: WizardStepState;
  /** Where the step stands, in words — *In progress · 3 outstanding*. A string, since it is also the description. */
  readonly status: string;
  readonly current?: boolean;
  /** The app's own link. A plain anchor otherwise. */
  readonly linkComponent?: NavLinkComponent;
}

export function WizardModuleItem({
  href,
  label,
  state,
  status,
  current = false,
  linkComponent,
}: WizardModuleItemProps) {
  const Link = linkComponent ?? Anchor;

  return (
    <li className={current ? styles.current : styles.step} data-state={state}>
      <WizardStepMark state={state} />
      <span className={styles.text}>
        <Link
          href={href}
          className={styles.link}
          aria-description={status}
          {...(current ? ({ 'aria-current': ARIA_CURRENT.STEP } as const) : {})}
        >
          {label}
        </Link>
        <span className={styles.status} aria-hidden="true">
          {status}
        </span>
      </span>
    </li>
  );
}
