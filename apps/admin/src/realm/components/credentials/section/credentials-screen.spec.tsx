import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { CredentialsScreen } from './credentials-screen';

/**
 * A-19 against the real Romanian catalogue (task 151). The wire module is the mocked seam; under test
 * are the screen's own duties — the states `design_spec.md` §5.2 A-19 lists, the one password field
 * and when it empties, where a notice is drawn, and that one write at a time holds the others still.
 * The browser journey (`e2e/admin/credentials.spec.ts`) proves the same screen against the api.
 */
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  change: vi.fn(),
  begin: vi.fn(),
  confirm: vi.fn(),
  issue: vi.fn(),
}));

vi.mock('../../../queries/credentials', () => ({
  ADMIN_CREDENTIALS_QUERY_KEY: ['admin', 'credentials'],
  adminCredentialsQuery: () => ({ queryKey: ['admin', 'credentials'], queryFn: mocks.read }),
  changeAdminPassword: mocks.change,
  beginAdminReenrolment: mocks.begin,
  confirmAdminReenrolment: mocks.confirm,
  issueAdminRecoveryCodes: mocks.issue,
}));

// The recovery-code region's signed-out arm navigates; no case here reaches it.
vi.mock('@tanstack/react-router', () => ({
  Navigate: () => null,
  useLocation: () => '/credentials',
}));

const ACCOUNT = { id: 'a', email: 'operator@easyesg.md', role: 'platform_administrator' } as const;
const ISSUED_AT = Date.UTC(2026, 8, 14, 9, 0);
const standing = (recoveryCodesIssuedAt: number | null, recoveryCodesRemaining: number) => ({
  status: 'ok',
  value: { recoveryCodesIssuedAt, recoveryCodesRemaining },
  messages: [],
});
const CODES = Array.from({ length: 10 }, (_, index) => `AAAA-BBBB-CCCC-${String(index).padStart(4, '0')}`);

const renderScreen = (arrival?: 'recovered') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale={CONSOLE_LOCALE} messages={ro} formats={formats} timeZone={CONSOLE_TIME_ZONE}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
  return render(<CredentialsScreen account={ACCOUNT} arrival={arrival} />, { wrapper });
};

const region = (name: string) => screen.getByRole('region', { name });
const gate = () => screen.getByLabelText('Parola actuală');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-19 · my credentials (task 151)', () => {
  it('issues the first set only with the current password, shows it once, then returns to the count', async () => {
    const user = userEvent.setup();
    mocks.read.mockResolvedValueOnce(standing(null, 0)).mockResolvedValue(standing(ISSUED_AT, 10));
    mocks.issue.mockResolvedValue({ status: 'ok', value: { recoveryCodes: CODES }, messages: [] });
    renderScreen();

    const codes = region('Coduri de recuperare');
    await within(codes).findByText('Nu ați emis încă niciun set de coduri de recuperare');

    // No password, no request: the field refuses, and says why.
    await user.click(within(codes).getByRole('button', { name: 'Emiteți coduri de recuperare' }));
    expect(await screen.findByText(/Parola actuală lipsește/)).toBeInTheDocument();
    expect(mocks.issue).not.toHaveBeenCalled();

    await user.type(gate(), 'Parola123!');
    await user.click(within(codes).getByRole('button', { name: 'Emiteți coduri de recuperare' }));

    const list = await within(codes).findByRole('list', { name: 'Codurile de recuperare' });
    expect(mocks.issue.mock.calls[0][0]).toEqual({ password: 'Parola123!' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    // "Shown once" is said before the list, in reading order — useful only in advance.
    const help = within(codes).getByText(/Le vedeți acum o singură dată/);
    expect(help.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gate()).toHaveValue('');

    await user.click(within(codes).getByRole('button', { name: 'Le-am păstrat' }));
    expect(await within(codes).findByText(/^10 coduri nefolosite din setul emis pe/)).toBeInTheDocument();
  });

  it('keeps the current password for a re-enrolment’s confirming step, and spends it once the factor is replaced', async () => {
    const user = userEvent.setup();
    mocks.read.mockResolvedValue(standing(ISSUED_AT, 10));
    mocks.begin.mockResolvedValue({
      status: 'ok',
      value: { secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/easyesg:operator?secret=JBSWY3DPEHPK3PXP' },
      messages: [],
    });
    mocks.confirm.mockResolvedValue({ status: 'ok', value: undefined, messages: [] });
    renderScreen();

    await user.type(gate(), 'Parola123!');
    const factor = region('Al doilea factor');
    await user.click(within(factor).getByRole('button', { name: 'Configurați o aplicație nouă' }));

    expect(await within(factor).findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(mocks.begin.mock.calls[0][0]).toEqual({ password: 'Parola123!' });
    // Typed once: the confirmation asks for the same password, so the field still holds it.
    expect(gate()).toHaveValue('Parola123!');

    await user.type(within(factor).getByLabelText('Cod de verificare din aplicația nouă'), '123456');
    await user.click(within(factor).getByRole('button', { name: 'Activați aplicația nouă' }));

    await within(factor).findByText('Aplicația nouă de autentificare este activă');
    expect(mocks.confirm.mock.calls[0][0]).toEqual({ password: 'Parola123!', code: '123456' });
    expect(gate()).toHaveValue('');
    expect(within(factor).queryByText('JBSWY3DPEHPK3PXP')).not.toBeInTheDocument();
  });

  it('draws a refusal inside the section that acted, and spends both passwords', async () => {
    const user = userEvent.setup();
    mocks.read.mockResolvedValue(standing(ISSUED_AT, 10));
    mocks.change.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/credential-invalid',
        status: 403,
        title: 'Parola actuală nu este corectă',
        detail: 'Parola actuală nu este corectă, așa că nu a fost modificat nimic.',
      },
    });
    renderScreen();

    await user.type(gate(), 'Gresita123!');
    const password = region('Parolă');
    await user.type(within(password).getByLabelText('Parola nouă'), 'ParolaNoua123!');
    await user.click(within(password).getByRole('button', { name: 'Schimbați parola' }));

    const alert = await within(password).findByRole('alert');
    expect(alert).toHaveTextContent('nu a fost modificat nimic');
    expect(mocks.change.mock.calls[0][0]).toEqual({
      currentPassword: 'Gresita123!',
      password: 'ParolaNoua123!',
      terminateOtherSessions: false,
    });
    expect(gate()).toHaveValue('');
    expect(within(password).getByLabelText('Parola nouă')).toHaveValue('');
    expect(within(region('Al doilea factor')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('holds every other write still while one runs', async () => {
    const user = userEvent.setup();
    mocks.read.mockResolvedValue(standing(ISSUED_AT, 10));
    mocks.change.mockReturnValue(new Promise(() => {}));
    renderScreen();

    await user.type(gate(), 'Parola123!');
    const password = region('Parolă');
    await user.type(within(password).getByLabelText('Parola nouă'), 'ParolaNoua123!');
    await user.click(within(password).getByRole('button', { name: 'Schimbați parola' }));

    const begin = within(region('Al doilea factor')).getByRole('button', {
      name: 'Configurați o aplicație nouă',
    });
    await waitFor(() => expect(begin).toBeDisabled());
  });

  it('names the codes left in the arrival notice after a recovery sign-in', async () => {
    mocks.read.mockResolvedValue(standing(ISSUED_AT, 9));
    renderScreen('recovered');

    expect(await screen.findByText(/V-au mai rămas 9 coduri nefolosite\./)).toBeInTheDocument();
    expect(screen.getByText('Ați intrat cu un cod de recuperare')).toBeInTheDocument();
  });

  it('keeps the password and the second factor usable when the codes cannot be read, with a retry for that region', async () => {
    const user = userEvent.setup();
    mocks.read.mockResolvedValueOnce({ status: 'unreachable' }).mockResolvedValue(standing(ISSUED_AT, 10));
    renderScreen();

    const codes = region('Coduri de recuperare');
    await within(codes).findByText('Codurile de recuperare nu au putut fi încărcate');
    expect(within(region('Parolă')).getByRole('button', { name: 'Schimbați parola' })).toBeEnabled();
    expect(
      within(region('Al doilea factor')).getByRole('button', { name: 'Configurați o aplicație nouă' }),
    ).toBeEnabled();

    await user.click(within(codes).getByRole('button', { name: 'Încercați din nou' }));
    expect(await within(codes).findByText(/^10 coduri nefolosite/)).toBeInTheDocument();
  });

  it('warns when every code of a set is spent, with the one issue action inside the warning', async () => {
    mocks.read.mockResolvedValue(standing(ISSUED_AT, 0));
    renderScreen();

    const codes = region('Coduri de recuperare');
    await within(codes).findByText('Nu mai aveți coduri de recuperare');
    expect(within(codes).getAllByRole('button', { name: 'Emiteți un set nou' })).toHaveLength(1);
  });
});
