import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityFieldLink } from './entity-field-link';

const leave = vi.fn();
vi.mock('../../shared/use-leave-guard', () => ({
  useLeaveGuard: () => ({ leave, guard: <p>the guard’s question</p> }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const HREF = '/entities/e-1#entity-idno';

/**
 * Task 210 (FR-42 behaviour 6; §12.5.6's task-210 row (2)): S-08's way to the entity's IDNO leaves the wizard as its exit
 * does — through the leave guard, which asks first where answers are unsent (UX-37). The guard's own behaviour is
 * `use-leave-guard.spec.tsx`'s; what is held here is that the link goes through it, and that its address is the record's.
 */
describe('EntityFieldLink', () => {
  beforeEach(() => leave.mockClear());

  it('is the entity’s record at the field, and draws the guard beside it', () => {
    render(<EntityFieldLink href={HREF}>Go to the field</EntityFieldLink>);
    expect(screen.getByRole('link', { name: 'Go to the field' })).toHaveAttribute('href', HREF);
    expect(screen.getByText('the guard’s question')).toBeInTheDocument();
  });

  it('leaves through the guard on a plain press, rather than navigating past it', () => {
    render(<EntityFieldLink href={HREF}>Go to the field</EntityFieldLink>);
    const pressed = fireEvent.click(screen.getByRole('link', { name: 'Go to the field' }));
    expect(leave).toHaveBeenCalledWith(HREF);
    // The default was prevented: `fireEvent` answers false when a handler cancelled it.
    expect(pressed).toBe(false);
  });

  it('leaves a modified press to the browser — a new tab abandons nothing', () => {
    render(<EntityFieldLink href={HREF}>Go to the field</EntityFieldLink>);
    // jsdom cannot open the tab the browser would, so the press is kept on the page once the link has answered it.
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener('click', stay);
    fireEvent.click(screen.getByRole('link', { name: 'Go to the field' }), { ctrlKey: true });
    document.removeEventListener('click', stay);
    expect(leave).not.toHaveBeenCalled();
  });
});
