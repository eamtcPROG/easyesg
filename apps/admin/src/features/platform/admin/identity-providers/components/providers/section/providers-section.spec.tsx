import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { IdentityProvider } from '@easyesg/contracts';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { ProvidersSection } from './providers-section';

/**
 * A-18 between a write's answer and the read it invalidates (23 Oct 2026), A-17's case in this screen's shape. The
 * wire module is the mocked seam and the read after the write is **held**. Under test is the order: the record's state
 * control is keyed by the revision it read, so a write made from it before that read lands would carry the revision
 * before the last one, which the api refuses as a colleague's. The browser journey
 * (`e2e/admin/identity-providers.spec.ts`) proves the same screen against the api.
 */
const mocks = vi.hoisted(() => ({ read: vi.fn(), run: vi.fn() }));

vi.mock('../../../queries/identity-providers', () => ({
  IDENTITY_PROVIDERS_QUERY_KEY: ['admin', 'identity-providers'],
  identityProvidersQuery: () => ({ queryKey: ['admin', 'identity-providers'], queryFn: mocks.read }),
  runProviderAction: mocks.run,
}));

// The read's signed-out arm navigates; no case here reaches it.
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ href: '/identity-providers' }),
  useNavigate: () => () => undefined,
}));

const google = (input: { readonly revision: number; readonly enabled: boolean }): IdentityProvider => ({
  provider: 'google',
  enabled: input.enabled,
  clientId: 'e2e-client.apps.googleusercontent.com',
  issuer: 'https://accounts.google.com',
  scopes: ['openid', 'email', 'profile'],
  redirectUris: ['http://localhost:3100/auth/social/google/callback'],
  revision: input.revision,
  enablementBlocker: null,
  secretHeld: true,
  secretSetting: 'AUTH_SOCIAL_GOOGLE_CLIENT_SECRET',
  linkedAccounts: 0,
  accountsWithoutOtherCredential: 0,
  changedByEmail: 'operator@easyesg.md',
  changedAt: Date.UTC(2026, 9, 23, 9, 0),
});

const listed = (provider: IdentityProvider) => ({
  status: 'ok',
  value: { items: [provider], total: 1, totalpages: 1 },
  messages: [],
});

/** A promise the case resolves when it chooses — the read that has not landed yet. */
function held<T>() {
  let release: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const renderSection = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale={CONSOLE_LOCALE} messages={ro} formats={formats} timeZone={CONSOLE_TIME_ZONE}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
  return render(<ProvidersSection search={{ provider: 'google' }} onSearchChange={() => undefined} />, { wrapper });
};

const ENABLED = 'Furnizorul Google este activat și apare pe pagina de autentificare.';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-18 · a write and the read after it', () => {
  it('draws the enablement once the record shows it, and disables next against the revision it made', async () => {
    const user = userEvent.setup();
    const reread = held<ReturnType<typeof listed>>();
    mocks.read
      .mockResolvedValueOnce(listed(google({ revision: 3, enabled: false })))
      .mockReturnValueOnce(reread.promise)
      .mockResolvedValue(listed(google({ revision: 5, enabled: false })));
    mocks.run
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'version-4', revision: 4 }, messages: [] })
      .mockResolvedValue({ status: 'ok', value: { id: 'version-5', revision: 5 }, messages: [] });
    renderSection();

    const record = await screen.findByRole('dialog', { name: 'Google' });
    await user.click(within(record).getByRole('button', { name: 'Activați furnizorul' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));

    // The write has answered and the read has not: the record still offers revision 3's control, held still.
    expect(screen.queryByText(ENABLED)).not.toBeInTheDocument();
    expect(within(record).getByRole('button', { name: 'Activați furnizorul' })).toBeDisabled();

    reread.release(listed(google({ revision: 4, enabled: true })));
    await screen.findByText(ENABLED);

    await user.click(within(record).getByRole('button', { name: 'Dezactivați furnizorul' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dezactivați' }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
    expect(mocks.run.mock.calls[1]?.[0]).toMatchObject({ control: 'disable', revision: 4 });
  });
});
