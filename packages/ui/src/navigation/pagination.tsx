'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './pagination.module.css';

/**
 * Pagination — §11.5's Navigation entry, and the Index archetype's fifth fixed element.
 *
 * **Built for a collection that is already loaded**, which is the case S-16 presented and is worth
 * stating because it is not the usual one: `/members` and `/invitations` are unpaginated by design,
 * bounded by the plan's seat allowance, so the page a reader is on is a view over rows the browser
 * already holds. The component therefore takes counts and a callback and issues no request; a
 * server-paged consumer supplies the same three numbers from its query and behaves identically.
 *
 * **It renders nothing for a single page.** A pager under a five-row list is furniture that teaches
 * a reader the list is longer than it is — and the Index archetype asks for pagination so that
 * finding one among many stays possible, not so that every instance carries the control.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · disabled at each end. There is no
 * loading state: the page change is synchronous over loaded rows, and a consumer that fetches
 * should keep its prior page visible (§8.1's *loading — refresh*) rather than blanking the table.
 */
export interface PaginationProps {
  /** 1-based, so it matches what the control renders and what a reader would say aloud. */
  page: number;
  pageSize: number;
  /** Rows in the whole collection, not on this page. */
  total: number;
  onPageChange: (page: number) => void;
  /** Localized by the caller, like every string in this package. */
  labels: {
    /** Accessible name for the region, e.g. "Pagination". */
    readonly region: string;
    readonly previous: string;
    readonly next: string;
    /** Rendered as the position, given the resolved numbers. */
    readonly position: (of: { from: number; to: number; total: number }) => string;
  };
}

export function Pagination({ page, pageSize, total, onPageChange, labels }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  // Clamped rather than trusted: a consumer that filtered its rows down while staying on page 4
  // would otherwise render "showing 61–80 of 12", and the arithmetic is cheaper than the contract.
  const current = Math.min(Math.max(page, 1), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label={labels.region}>
      <button
        type="button"
        className={styles.step}
        onClick={() => onPageChange(current - 1)}
        disabled={current === 1}
      >
        <ChevronLeft className={styles.icon} aria-hidden="true" />
        {labels.previous}
      </button>

      {/* `status`, so a screen reader hears the new position after a page change rather than
          having to go looking for it. The text is the position, never the icons beside it. */}
      <span className={`t-caption ${styles.position}`} role="status">
        {labels.position({ from, to, total })}
      </span>

      <button
        type="button"
        className={styles.step}
        onClick={() => onPageChange(current + 1)}
        disabled={current === pages}
      >
        {labels.next}
        <ChevronRight className={styles.icon} aria-hidden="true" />
      </button>
    </nav>
  );
}
