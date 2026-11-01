import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './form-error-summary.module.css';

/**
 * Form-level error summary — UX-111: at the top of the form, with links to each field. The
 * links target the field ids `TextField` exposes, which is §8.4's finding-to-destination
 * discipline at form scale: a message that says something is wrong without saying where is a
 * defect, not a rough edge.
 *
 * `role="alert"` announces the summary when it appears. The caller renders it only when there
 * is something to say, with messages already localized and three-part (NFR-79).
 */
export interface FormErrorSummaryItem {
  fieldId: string;
  message: ReactNode;
}

export interface FormErrorSummaryProps {
  /** Localized heading — what happened at form level. */
  title: ReactNode;
  items: readonly FormErrorSummaryItem[];
}

export function FormErrorSummary({ title, items }: FormErrorSummaryProps) {
  if (items.length === 0) return null;

  return (
    <div role="alert" className={styles.summary}>
      <p className={styles.title}>
        <CircleAlert aria-hidden="true" className={styles.icon} />
        {title}
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.fieldId}>
            <a href={`#${item.fieldId}`}>{item.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
