import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { NotificationBell } from './notification-bell';

/** The band's notification entry (task 50.2.1): one link, named with its count, the count drawn only when there is one. */
describe('NotificationBell', () => {
  it("is one link to the centre, named by the caller's sentence, with the count drawn and not read twice", () => {
    render(<NotificationBell href="/notifications" label="Notifications, 4 unread" count={4} />);

    const link = screen.getByRole('link', { name: 'Notifications, 4 unread' });
    expect(link).toHaveAttribute('href', '/notifications');
    expect(link).toHaveTextContent('4');
    // The badge is inside the link and hidden, so the name stays the sentence alone.
    expect(screen.getByText('4').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it.each([
    ['unknown', null],
    ['zero', 0],
  ])('draws no count while it is %s', (_case, count) => {
    render(<NotificationBell href="/notifications" label="Notifications" count={count} />);

    expect(screen.getByRole('link', { name: 'Notifications' })).not.toHaveTextContent(/\d/);
  });

  it('says so when the reader is on the centre itself', () => {
    render(<NotificationBell href="/notifications" label="Notifications" count={null} current />);

    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('aria-current', 'page');
  });

  it("uses the caller's router when given one", () => {
    const Routed = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
      <a href={`/ro${href}`} className={className} data-routed="yes">
        {children}
      </a>
    );
    render(<NotificationBell href="/notifications" label="Notificări" count={2} linkComponent={Routed} />);

    expect(screen.getByRole('link', { name: 'Notificări' })).toHaveAttribute('data-routed', 'yes');
  });
});
