import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import ro from '@/messages/ro.json';
import { encodeCookieChoice } from '../../tools/cookie-choice-cookie';
import { recordCookieChoiceAction } from '../../actions/actions';
import { CookieSettingsButton } from '../settings-button/cookie-settings-button';
import { CookieChoice } from './cookie-choice';

/**
 * S-31 beside a page (task 223; FR-206 AC-2, AC-3, AC-8), against the real Romanian catalogue: the banner shows until
 * the browser holds an answer to the policy in force, an answer from either place records the same thing, a failure
 * keeps the banner and says so, the settings offer nothing to switch — and a footer's button reaches the island with no
 * provider around the page, which is what keeps the page's own streaming hydration untouched.
 */
vi.mock('../../actions/actions', () => ({ recordCookieChoiceAction: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));

const record = vi.mocked(recordCookieChoiceAction);
const t = ro.legal.cookieChoice;
const COOKIE = 'easyesg_cookie_choice';
const answerFor = (policyVersion: string) =>
  encodeCookieChoice({ id: '01920000-0000-7000-8000-000000000001', policyVersion, chosenAt: Date.UTC(2026, 9, 23) });

/** The browser's jar, as the Server Action's `Set-Cookie` would leave it. */
const holdAnswer = (policyVersion: string) => {
  document.cookie = `${COOKIE}=${encodeURIComponent(answerFor(policyVersion))}; path=/`;
};

const renderPage = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <footer>
        <CookieSettingsButton />
      </footer>
      <CookieChoice necessaryCookies={['easyesg_session', 'NEXT_LOCALE', COOKIE]} />
    </NextIntlClientProvider>,
  );

const banner = () => screen.queryByRole('region', { name: t.banner.title });

const reserved = () => document.documentElement.style.getPropertyValue('--cookie-banner-block-size');

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no `ResizeObserver`, nor any layout: this one answers the banner's height at once.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: (entries: { borderBoxSize: { blockSize: number }[] }[]) => void) {}
      observe() {
        this.callback([{ borderBoxSize: [{ blockSize: 120.4 }] }]);
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  document.cookie = `${COOKIE}=; max-age=0; path=/`;
  vi.unstubAllGlobals();
});

describe('S-31 · the cookie choice', () => {
  it('shows the banner to a browser that has not answered, and the page reserves its height', () => {
    renderPage();
    expect(banner()).toBeInTheDocument();
    expect(reserved()).toBe('121px');
  });

  it('shows no banner to a browser that answered the policy in force', () => {
    holdAnswer(COOKIE_POLICY_VERSION_IN_FORCE);
    renderPage();
    expect(banner()).not.toBeInTheDocument();
  });

  it('shows it again once the policy has moved past the answer', () => {
    holdAnswer('0.1');
    renderPage();
    expect(banner()).toBeInTheDocument();
  });

  it('records *I understand* and leaves once the answer is in the jar', async () => {
    const user = userEvent.setup();
    record.mockImplementation(() => {
      holdAnswer(COOKIE_POLICY_VERSION_IN_FORCE);
      return Promise.resolve(undefined);
    });
    renderPage();

    await user.click(within(banner()!).getByRole('button', { name: t.banner.understood }));

    expect(record).toHaveBeenCalledTimes(1);
    expect(banner()).not.toBeInTheDocument();
    // Gone with the banner, so the page reserves nothing.
    expect(reserved()).toBe('');
  });

  it('keeps the banner when the answer is not recorded, and says so', async () => {
    const user = userEvent.setup();
    record.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    renderPage();

    await user.click(within(banner()!).getByRole('button', { name: t.banner.understood }));

    expect(within(banner()!).getByText(t.failed.title)).toBeInTheDocument();
  });

  it('opens the settings from the footer: one category, always on, nothing to switch — and *Save* records the answer', async () => {
    const user = userEvent.setup();
    record.mockImplementation(() => {
      holdAnswer(COOKIE_POLICY_VERSION_IN_FORCE);
      return Promise.resolve(undefined);
    });
    renderPage();

    await user.click(within(screen.getByRole('contentinfo')).getByRole('button', { name: t.settingsButton }));
    const dialog = screen.getByRole('dialog', { name: t.settings.title });

    expect(within(dialog).getByText(t.settings.necessary.always)).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: t.settings.necessary.names })).toHaveTextContent(COOKIE);
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: t.settings.save }));
    await act(() => Promise.resolve());

    expect(record).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
  });
});
