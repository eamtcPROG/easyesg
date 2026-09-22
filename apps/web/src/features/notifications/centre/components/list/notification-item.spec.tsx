import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotificationItem as Notice } from '@easyesg/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { markNoticeOpened } from '@/client/notifications/mark-notice-opened';
import ro from '@/messages/ro.json';
import { NotificationItem } from './notification-item';

/**
 * §11.5's Notification item (task 50.2.1): every notice a link to what raised it, every other part absent where the
 * API sent none, and opening an unread notice marking it read. The link is a plain anchor here and the mark a stub —
 * what reaches the API is `mark-notice-opened.spec.ts`'s and the browser suite's.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a
      href={href}
      {...rest}
      // A real navigation would unload jsdom's document; the click's handler is what is under test.
      onClick={(event) => {
        (rest as { onClick?: (event: unknown) => void }).onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('@/client/notifications/mark-notice-opened', () => ({ markNoticeOpened: vi.fn() }));

const NOTICE: Notice = {
  id: '0192f000-0000-7000-8000-00000000a001',
  categoryKey: 'identity.invitation',
  categoryName: 'Echipă',
  title: 'Victor Rusu a acceptat invitația',
  body: 'Poate edita rapoartele pentru Lina Logistic SRL.',
  actionLabel: 'Utilizatori și acces',
  deepLink: '/organization/users',
  receivedAt: Date.UTC(2026, 8, 22, 9, 2),
  readAt: null,
};

const renderItem = (notice: Notice) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="ro" messages={{ notifications: ro.notifications }}>
        <NotificationItem notice={notice} received="Azi, 12:02" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe('NotificationItem', () => {
  it("draws every part the API sent, its action words the link to what raised it", () => {
    renderItem(NOTICE);

    expect(screen.getByRole('link', { name: 'Utilizatori și acces' })).toHaveAttribute('href', '/organization/users');
    // With action words the title is text, so the notice is one link rather than two to the same place.
    expect(screen.queryByRole('link', { name: NOTICE.title })).toBeNull();
    expect(screen.getByText(NOTICE.title as string)).toBeInTheDocument();
    expect(screen.getByText('Echipă')).toBeInTheDocument();
    expect(screen.getByText(NOTICE.body as string)).toBeInTheDocument();
    expect(screen.getByText('Azi, 12:02').closest('time')).toHaveAttribute('dateTime', '2026-09-22T09:02:00.000Z');
    // UX-102: the dot is not the only carrier of unread.
    expect(screen.getByText(ro.notifications.item.unread)).toBeInTheDocument();
  });

  it('makes the title the link where no action words were written, and draws no absent part', () => {
    const { container } = renderItem({ ...NOTICE, actionLabel: undefined, categoryName: undefined, body: undefined });

    expect(screen.getByRole('link', { name: NOTICE.title })).toHaveAttribute('href', '/organization/users');
    expect(screen.queryByText('Echipă')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it("names a notice with no title by this app's word for one, never by nothing", () => {
    renderItem({ ...NOTICE, title: undefined, actionLabel: undefined });

    expect(screen.getByRole('link', { name: ro.notifications.item.untitled })).toBeInTheDocument();
  });

  it('marks an unread notice read as it is opened, and a read one not at all', async () => {
    const { unmount } = renderItem(NOTICE);
    await userEvent.click(screen.getByRole('link', { name: 'Utilizatori și acces' }));
    expect(markNoticeOpened).toHaveBeenCalledWith(expect.objectContaining({ notificationId: NOTICE.id }));
    unmount();

    vi.mocked(markNoticeOpened).mockClear();
    renderItem({ ...NOTICE, readAt: Date.UTC(2026, 8, 22, 10, 0) });
    await userEvent.click(screen.getByRole('link', { name: 'Utilizatori și acces' }));
    expect(markNoticeOpened).not.toHaveBeenCalled();
    expect(screen.queryByText(ro.notifications.item.unread)).toBeNull();
  });
});
