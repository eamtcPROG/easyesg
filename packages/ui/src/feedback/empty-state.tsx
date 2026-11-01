import type { ReactNode } from 'react';
import styles from './empty-state.module.css';

/**
 * Empty state — §11.5's Feedback entry, and §4.6's standing requirement of the Index archetype:
 * *"always has an empty state that teaches"*.
 *
 * **The two §8.1 states are different components' worth of content, and the API separates them.**
 * *Empty — first use* "teaches what the object is and offers the one action that creates it. Never
 * a bare 'no data'." *Empty — filtered* "distinguishes 'nothing matches' from 'nothing exists', and
 * offers to clear the filter." Collapsing them into one component with a boolean is the shape UX-89
 * warns about — and worse, it is how a filtered list ends up inviting someone to create a second
 * object they already have.
 *
 * `title` and `children` carry what happened and what it means; `action` is the step that resolves
 * it — the same three-part shape §11.5 requires of everything in Feedback, and required here rather
 * than optional for the same reason `Callout` requires it.
 */
export interface EmptyStateProps {
  /** What the reader is looking at. Localized by the caller, like every string in this package. */
  title: ReactNode;
  /** What it means, and for *first use*, what the object is for. */
  children: ReactNode;
  /** The one action: create the first object, or clear the filter. Never omitted. */
  action: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    // `status`, not `alert`: an empty list is a resolved state rather than an interruption, and a
    // screen that announced it assertively would talk over a reader who has just typed a filter.
    <div className={styles.empty} role="status">
      <p className={`t-heading-3 ${styles.title}`}>{title}</p>
      <p className={`t-body ${styles.body}`}>{children}</p>
      <div className={styles.action}>{action}</div>
    </div>
  );
}
