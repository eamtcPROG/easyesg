import { type RefObject, useEffect } from 'react';

/** The custom property the page and the signed-in column reserve the banner's height by (`globals.css`). */
export const BANNER_BLOCK_PROPERTY = '--cookie-banner-block-size';

/**
 * Publishes the banner's height to the page while it is shown (task 223; `design_spec.md` S-31's layout): the banner is
 * fixed at the foot of the viewport, and the page reserves the same height beneath its content — the document by its
 * `body`'s padding, the signed-in column by its own height — so nothing ever sits behind it, at any width or text size.
 *
 * **Measured rather than assumed**: the banner's height moves with the locale, the frame and the reader's text size, and
 * a figure written in CSS would be right for one of them.
 */
export function useReservedBlock(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(BANNER_BLOCK_PROPERTY, `${Math.ceil(entry.borderBoxSize[0]?.blockSize ?? element.offsetHeight)}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(BANNER_BLOCK_PROPERTY);
    };
  }, [ref]);
}
