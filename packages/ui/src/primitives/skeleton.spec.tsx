import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';
import { SKELETON_SHAPE } from './skeleton-vocabulary';

/**
 * §11.5's Skeleton, and what a jsdom spec can honestly hold of it.
 *
 * The 300 ms restraint, the shimmer and the reduced-motion opt-out are **CSS**, and jsdom computes
 * no animations — asserting on them here would be the inert check this repository refuses. What is
 * assertable is the contract every consumer depends on: the bar is hidden from assistive technology
 * so the container can name the wait, the shape drives the class rather than an inline style, and
 * the caller's own class survives alongside it, which is what lets a skeleton match a layout this
 * package knows nothing about.
 */
describe('Skeleton', () => {
  it('is hidden from assistive technology, so the container names the wait', () => {
    const { container } = render(<Skeleton />);
    const bar = container.firstElementChild;

    // **On the bar, not on the tree.** The first draft asked `queryByRole('generic')` to find
    // nothing and it found Testing Library's own wrapper `<div>` — the assertion naming the
    // harness rather than the subject, which is how a check ends up green for the wrong reason.
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    // And it carries no text to announce even if something did read it (UX-102).
    expect(bar?.textContent).toBe('');
  });

  it('carries a different class per shape, and text is the default', () => {
    const { container: byDefault } = render(<Skeleton />);
    const { container: heading } = render(<Skeleton shape={SKELETON_SHAPE.HEADING} />);
    const { container: block } = render(<Skeleton shape={SKELETON_SHAPE.BLOCK} />);

    const classOf = (root: HTMLElement) => root.firstElementChild?.className ?? '';
    const [defaultClasses, headingClasses, blockClasses] = [
      classOf(byDefault),
      classOf(heading),
      classOf(block),
    ];

    expect(defaultClasses).toBe(classOf(byDefault));
    expect(headingClasses).not.toBe(defaultClasses);
    expect(blockClasses).not.toBe(defaultClasses);
    expect(blockClasses).not.toBe(headingClasses);
  });

  it('keeps the caller’s class beside its own — the half of "matching the layout" it does not own', () => {
    const { container } = render(<Skeleton className="caller-owns-the-width" />);

    const classes = container.firstElementChild?.className ?? '';
    expect(classes).toContain('caller-owns-the-width');
    // And not *instead* of its own: a replaced class would drop the shape and the animation.
    expect(classes.split(' ').length).toBeGreaterThan(1);
  });

  it('renders no inline style, so every value stays in the cascade (UX-79)', () => {
    const { container } = render(<Skeleton shape={SKELETON_SHAPE.BLOCK} />);

    expect(container.firstElementChild?.getAttribute('style')).toBeNull();
  });
});
