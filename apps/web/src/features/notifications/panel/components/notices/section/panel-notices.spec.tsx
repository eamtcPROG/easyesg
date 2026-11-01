import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formats } from '@/i18n/formats';
import ro from '@/messages/ro.json';
import { PanelNotices } from './panel-notices';
import { usePanelNotices } from './use-panel-notices';

/**
 * The panel's notices (task 50.2.2): which arm a read is in, over a stubbed read — the read itself is
 * `read-notices.spec.ts`'s, and the browser suite drives the two together.
 */
vi.mock('./use-panel-notices', () => ({ usePanelNotices: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const answer = (data: unknown, refetch = vi.fn()) =>
  vi.mocked(usePanelNotices).mockReturnValue({ data, refetch } as unknown as ReturnType<typeof usePanelNotices>);

const renderNotices = (onShowAll = vi.fn(), timeZone = 'Europe/Chisinau') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider
        locale="ro"
        messages={{ notifications: ro.notifications }}
        formats={formats}
        timeZone={timeZone}
        now={new Date('2026-09-22T12:00:00Z')}
      >
        <PanelNotices organizationId="0b8a1f3e-0000-4000-8000-000000000001" show="unread" onShowAll={onShowAll} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

const NOTICE = {
  id: '0192f000-0000-7000-8000-00000000a001',
  categoryKey: 'identity.invitation' as const,
  deepLink: '/reports',
  receivedAt: Date.UTC(2026, 8, 22, 9, 2),
  readAt: null,
};

describe('PanelNotices', () => {
  it('waits in the list’s shape until the read answers', () => {
    answer(undefined);
    renderNotices();
    expect(screen.getByRole('status')).toHaveTextContent(ro.notifications.panel.loading);
  });

  it('says so when the read could not be made, and asks again from here', async () => {
    const refetch = vi.fn();
    answer(null, refetch);
    renderNotices();

    expect(screen.getByText(ro.notifications.panel.unreachable.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ro.notifications.panel.unreachable.action }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('teaches first use when nothing has reached the centre, and says nothing unread when all is read', async () => {
    answer({ items: [], matched: 0, total: 0 });
    const { unmount } = renderNotices();
    expect(screen.getByText(ro.notifications.panel.empty.firstUse.title)).toBeInTheDocument();
    unmount();

    const onShowAll = vi.fn();
    answer({ items: [], matched: 0, total: 3 });
    renderNotices(onShowAll);
    expect(screen.getByText(ro.notifications.panel.empty.nothingUnread.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ro.notifications.panel.empty.nothingUnread.action }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('lists what the read matched, each notice worded today in the configured zone', () => {
    answer({ items: [NOTICE], matched: 1, total: 1 });
    renderNotices();

    expect(screen.getByRole('list', { name: ro.notifications.panel.list }).querySelectorAll('li')).toHaveLength(1);
    // 09:02 UTC is 12:02 in Chișinău in September — the configured zone, not the machine's.
    expect(screen.getByText('Azi, 12:02')).toBeInTheDocument();
  });

  // Chișinău is this host's own zone and three hours from CI's, so the case above cannot tell the configured zone from
  // the machine's everywhere. At UTC+14 the notice is from the evening before and *now* is the next morning: a label
  // worded in the machine's zone — Chișinău's or UTC — says today, and one worded in the configured zone does not.
  it("words the day in the configured zone, even where the machine's day would say today", () => {
    answer({ items: [NOTICE], matched: 1, total: 1 });
    renderNotices(vi.fn(), 'Pacific/Kiritimati');

    expect(screen.queryByText(/^Azi/)).not.toBeInTheDocument();
    expect(screen.getByText(/23:02/)).toBeInTheDocument();
  });
});
