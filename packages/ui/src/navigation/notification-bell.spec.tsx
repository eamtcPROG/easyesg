import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './notification-bell';

/** The band's notification entry (task 50.2.2): one button, named with its count, taking what a trigger hands it. */
describe('NotificationBell', () => {
  it("is one button named by the caller's sentence, with the count drawn and not read twice", () => {
    render(<NotificationBell label="Notifications, 4 unread" count={4} />);

    const bell = screen.getByRole('button', { name: 'Notifications, 4 unread' });
    expect(bell).toHaveAttribute('type', 'button');
    expect(bell).toHaveTextContent('4');
    expect(screen.getByText('4').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it.each([
    ['unknown', null],
    ['zero', 0],
  ])('draws no count while it is %s', (_case, count) => {
    render(<NotificationBell label="Notifications" count={count} />);

    expect(screen.getByRole('button', { name: 'Notifications' })).not.toHaveTextContent(/\d/);
  });

  // What a Radix `Popover.Trigger asChild` merges onto its child: a handler, the popup's state, and the ref.
  it('spreads what a trigger hands it onto the button', async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <NotificationBell label="Notificări" count={2} onClick={onClick} aria-expanded="true" aria-controls="panel" ref={ref} />,
    );

    const bell = screen.getByRole('button', { name: 'Notificări' });
    await userEvent.click(bell);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    expect(bell).toHaveAttribute('aria-controls', 'panel');
    expect(ref.current).toBe(bell);
  });
});
