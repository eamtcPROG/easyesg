import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LockedNavEntry } from './locked-nav-entry';

/**
 * A section the reader's role may not open (task 173) — what a screen reader is told, and that there is nothing
 * to follow. The band's and the drawer's specs hold each surface to drawing it; this holds the entry itself.
 */
describe('LockedNavEntry', () => {
  it('is a disabled link, named by its label and its note', () => {
    render(<LockedNavEntry label="Organization" note="(administrators only)" />);

    // `role="link"` so it is listed among the links; `aria-disabled` so it is listed as unavailable. The note is
    // part of the name — a description is read on focus, and this entry is never focused.
    const entry = screen.getByRole('link', { name: 'Organization (administrators only)' });
    expect(entry).toHaveAttribute('aria-disabled', 'true');
  });

  it('has nothing to follow and no place in the tab order', () => {
    render(<LockedNavEntry label="Organization" note="(administrators only)" />);

    const entry = screen.getByRole('link');
    expect(entry).not.toHaveAttribute('href');
    expect(entry).not.toHaveAttribute('tabindex');
    // A `<span>`, which the browser never focuses — an `<a>` without `href` would not be focused either, but a
    // later `href` added by mistake would make it followable; a span cannot become one by an attribute.
    expect(entry.tagName).toBe('SPAN');
  });

  it('keeps the surface’s own class beside its own', () => {
    render(<LockedNavEntry label="Organization" note="(administrators only)" className="row" />);

    const entry = screen.getByRole('link');
    expect(entry).toHaveClass('row');
    // The module's class, whatever CSS modules names it: a caller's class must add to it, never replace it.
    expect(entry.classList).toHaveLength(2);
  });
});
