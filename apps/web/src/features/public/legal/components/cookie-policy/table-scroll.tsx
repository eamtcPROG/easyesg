'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const REGION = 'region';

/**
 * The cookie table's card: it scrolls sideways inside itself where the four columns cannot fit, which is the rule a
 * table keeps at `compact` (UX-77, and `DataTable`'s card), so the page never does.
 *
 * **While it scrolls, and only then, it is a region named by the table's caption and a tab stop** — a scroller with
 * nothing focusable inside is otherwise out of a keyboard's reach (WCAG 2.1.1). At every width a phone has, the
 * columns fit and the card is a plain box; the arm is 320px in Russian, UX-103's frame, on a host with no Russian
 * hyphenation, where one word outgrows its column.
 *
 * **The policy's one piece of client code, and a leaf**: it measures and marks the box, and renders the table it is
 * handed untouched, so the table and the page around it stay Server Components.
 */
export function TableScroll({
  className,
  labelledBy,
  children,
}: {
  className: string;
  /** The id of the table's caption, which names the region. */
  labelledBy: string;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const box = card.current;
    if (!box) return;
    const measure = () => setScrolls(box.scrollWidth > box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    // The table too: it grows inside a card whose own size does not change — a font arriving, a word unhyphenated.
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={card}
      className={className}
      role={scrolls ? REGION : undefined}
      aria-labelledby={scrolls ? labelledBy : undefined}
      tabIndex={scrolls ? 0 : undefined}
    >
      {children}
    </div>
  );
}
