import { Check, Dot } from 'lucide-react';
import styles from './requirement-list.module.css';

/**
 * Requirement checklist — the "policy displayed before entry rather than only on failure"
 * surface S-02 requires for the password policy, generic over any requirement set.
 *
 * Each item answers itself as the user types. The met state is never carried by the glyph or
 * the colour alone (UX-102): every item carries visually-hidden met/unmet text, supplied
 * localized by the caller. The list is intentionally NOT a live region — announcing five
 * verdicts on every keystroke is noise, and the authoritative failure still arrives as the
 * field's inline error on submit, which is announced through `aria-describedby`.
 */
export interface RequirementItem {
  key: string;
  /** Localized requirement text. */
  label: string;
  met: boolean;
}

export interface RequirementListProps {
  items: readonly RequirementItem[];
  /** Visually hidden, localized: appended to a satisfied item ("met"). */
  metLabel: string;
  /** Visually hidden, localized: appended to an unsatisfied item ("not met yet"). */
  unmetLabel: string;
}

export function RequirementList({ items, metLabel, unmetLabel }: RequirementListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={item.met ? styles.met : styles.unmet}>
          {item.met ? (
            <Check aria-hidden="true" className={styles.icon} />
          ) : (
            <Dot aria-hidden="true" className={styles.icon} />
          )}
          <span>
            {item.label}
            <span className={styles.assistive}>{` — ${item.met ? metLabel : unmetLabel}`}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
