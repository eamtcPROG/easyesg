import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { PanelTabs } from './panel-tabs';

const renderTabs = (props: Parameters<typeof PanelTabs>[0]) =>
  render(
    <NextIntlClientProvider locale="ro" messages={{ notifications: ro.notifications }}>
      <PanelTabs {...props} />
    </NextIntlClientProvider>,
  );

/** The panel's two views (task 50.2.2): toggles that say which is pressed, the count drawn only when known. */
describe('PanelTabs', () => {
  it('presses the view shown, and hands the other up when chosen', async () => {
    const onShow = vi.fn();
    renderTabs({ show: 'unread', unread: 3, onShow });

    expect(screen.getByRole('button', { name: 'Necitite · 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Toate' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Toate' }));
    expect(onShow).toHaveBeenCalledWith('all');
  });

  it('leaves the count out while it is unknown, rather than drawing a zero', () => {
    renderTabs({ show: 'all', unread: null, onShow: vi.fn() });

    expect(screen.getByRole('button', { name: 'Necitite' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/· 0/)).toBeNull();
  });
});
