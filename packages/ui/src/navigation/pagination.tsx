'use client';

import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { Select } from '../form/select';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import { PAGE_GAP, pageWindow } from './pagination-window';
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
 * **Pages by number since task 170**, as the Components sheet's specimen draws them (*‹ 1 2 3 ›*):
 * the first, the last, the current one and its neighbours, with a gap between — `pagination-window.ts`
 * holds the rule and its spec. Previous and next stay, labelled, at the ends.
 *
 * **It renders nothing for a single page — unless it offers a size.** A pager under a five-row list is
 * furniture that teaches a reader the list is longer than it is. But a footer carrying a rows-per-page
 * choice must stay once that choice has made everything fit one page, or the reader who chose 100 can
 * never choose 25 again — so `sizes` keeps it, and the console's paged lists pass it (`design_spec.md`
 * §5.2's preamble, task 170). The tenant screens pass none and are unchanged.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · current page · disabled at each end.
 * There is no loading state: a consumer that fetches should keep its prior page visible (§8.1's
 * *loading — refresh*) rather than blanking the table.
 */
export interface PaginationProps {
  /** 1-based, so it matches what the control renders and what a reader would say aloud. */
  page: number;
  pageSize: number;
  /** Rows in the whole collection, not on this page. */
  total: number;
  onPageChange: (page: number) => void;
  /**
   * A rows-per-page choice, offered together or not at all. Present, the footer always renders — see
   * the note above.
   */
  sizes?: {
    readonly options: readonly number[];
    readonly onChange: (pageSize: number) => void;
    /** The choice's label, localized by the caller — with the choice, so one cannot come without the other. */
    readonly label: string;
  };
  /** Localized by the caller, like every string in this package. */
  labels: {
    /** Accessible name for the region, e.g. "Pagination". */
    readonly region: string;
    readonly previous: string;
    readonly next: string;
    /** Rendered as the position, given the resolved numbers. */
    readonly position: (of: { from: number; to: number; total: number }) => string;
    /** A numbered page's accessible name, e.g. "Page 3" — its visible text is the bare number. */
    readonly page: (page: number) => string;
  };
}

export function Pagination({ page, pageSize, total, onPageChange, sizes, labels }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && sizes === undefined) return null;

  // Clamped rather than trusted: a consumer that filtered its rows down while staying on page 4
  // would otherwise render "showing 61–80 of 12", and the arithmetic is cheaper than the contract.
  const current = Math.min(Math.max(page, 1), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label={labels.region}>
      <div className={styles.summary}>
        {/* `status`, so a screen reader hears the new position after a page change rather than
            having to go looking for it. */}
        <span className={`t-caption ${styles.position}`} role="status">
          {labels.position({ from, to, total })}
        </span>
        {sizes === undefined ? null : (
          <span className={styles.size}>
            {/* The visible words; the select carries the same label for assistive technology, so this
                copy is hidden from it rather than read twice. */}
            <span className="t-caption" aria-hidden="true">
              {sizes.label}
            </span>
            <Select
              label={sizes.label}
              labelHidden
              className={styles.sizeSelect}
              value={String(pageSize)}
              onValueChange={(value) => sizes.onChange(Number.parseInt(value, 10))}
              options={sizes.options.map((option) => ({ value: String(option), label: String(option) }))}
            />
          </span>
        )}
      </div>

      {pages <= 1 ? null : (
        <div className={styles.steps}>
          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(current - 1)}
            disabled={current === 1}
          >
            <ChevronLeft className={styles.icon} aria-hidden="true" />
            {labels.previous}
          </button>

          <ul className={styles.pages}>
            {pageWindow({ current, pages }).map((entry, index) =>
              entry === PAGE_GAP ? (
                // Keyed by position: a gap has no identity of its own, and there are at most two.
                <li key={`gap-${String(index)}`} className={styles.gap} aria-hidden="true">
                  <Ellipsis className={styles.icon} />
                </li>
              ) : (
                <li key={entry}>
                  <button
                    type="button"
                    className={styles.number}
                    aria-label={labels.page(entry)}
                    {...(entry === current ? { 'aria-current': ARIA_CURRENT.PAGE } : {})}
                    onClick={() => onPageChange(entry)}
                  >
                    {entry}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(current + 1)}
            disabled={current === pages}
          >
            {labels.next}
            <ChevronRight className={styles.icon} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
