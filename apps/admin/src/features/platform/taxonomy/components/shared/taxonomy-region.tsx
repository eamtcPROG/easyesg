import type { ReactNode } from 'react';

/**
 * One of A-04's regions: a section named by its `h2` (tasks 67.6, 67.7). Read by every region of the screen, which is
 * this leaf's admission — the heading's level follows from the screen's one `h1`, so no region chooses its own.
 */
export function TaxonomyRegion({
  id,
  title,
  lede,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly lede?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-[var(--space-3)]">
      <h2 id={id} className="t-heading-3">
        {title}
      </h2>
      {lede === undefined ? null : <p className="t-body text-[var(--text-muted)]">{lede}</p>}
      {children}
    </section>
  );
}
