/**
 * Which page numbers a pager draws (task 170) — the first, the last, the current one and its two
 * neighbours, with a gap where pages are skipped. Pure, and out of the component with its spec beside
 * it, because the rule has edges a render test would find only by accident: a gap of exactly one page
 * is drawn as that page, since a `…` standing for a single number hides it for no saving.
 */
export const PAGE_GAP = 'gap' as const;

export type PageWindowEntry = number | typeof PAGE_GAP;

/** Up to this many pages, every one is drawn and there is nothing to elide. */
const WHOLE_UP_TO = 7;

export function pageWindow({
  current,
  pages,
}: {
  readonly current: number;
  readonly pages: number;
}): readonly PageWindowEntry[] {
  if (pages <= WHOLE_UP_TO) return Array.from({ length: pages }, (_, index) => index + 1);

  const shown = new Set([1, pages, current - 1, current, current + 1]);
  const numbers = [...shown].filter((page) => page >= 1 && page <= pages).sort((a, b) => a - b);

  const entries: PageWindowEntry[] = [];
  let previous = 0;
  for (const page of numbers) {
    if (page - previous === 2) entries.push(previous + 1);
    else if (page - previous > 2) entries.push(PAGE_GAP);
    entries.push(page);
    previous = page;
  }
  return entries;
}
