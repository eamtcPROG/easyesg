import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { beginSignIn, completeSignIn } from '../session';
import { SignInScreen } from './sign-in-screen';

/**
 * A-01 against the real Romanian catalogue — the two-step handshake as the screen carries it.
 * The session module is the mocked seam; under test are the screen's own duties: the staged
 * flow (credential → factor with the server-verified address shown), the UX-111 summaries, the
 * api's refusals rendered as received, and the one branch it owns — a lapsed challenge sends
 * the flow back to the credential step.
 */
vi.mock('../session', () => ({
  beginSignIn: vi.fn(),
  completeSignIn: vi.fn(),
}));

const beginMock = vi.mocked(beginSignIn);
const completeMock = vi.mocked(completeSignIn);

const onSignedIn = vi.fn();

const renderScreen = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider
      locale={CONSOLE_LOCALE}
      messages={ro}
      formats={formats}
      timeZone={CONSOLE_TIME_ZONE}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
  return render(<SignInScreen onSignedIn={onSignedIn} />, { wrapper });
};

const EMAIL = 'operator@easyesg.md';

const openChallenge = async (user: ReturnType<typeof userEvent.setup>) => {
  beginMock.mockResolvedValue({
    status: 'ok',
    value: { email: EMAIL, expiresAt: Date.now() + 5 * 60 * 1000 },
    messages: [],
  });
  await user.type(screen.getByLabelText('Adresa de e-mail'), EMAIL);
  await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
  await user.click(screen.getByRole('button', { name: 'Continuă' }));
  await screen.findByRole('heading', { name: 'Confirmă al doilea factor' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-01 · admin sign-in screen (two-step handshake)', () => {
  it('opens with the credential step and advances to the factor step naming the verified address', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Autentificare operator' })).toBeInTheDocument();
    await openChallenge(user);

    expect(beginMock.mock.calls[0][0]).toEqual({ email: EMAIL, password: 'Parola123!' });
    // "Conectat ca …" is a server-established fact on this step (the handshake's point).
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.queryByLabelText('Parolă')).not.toBeInTheDocument();
    // The code field arrives EMPTY. Not a formality: while both steps were a `<form>` at the
    // same position, React reconciled them and reused the uncontrolled input's DOM node, so the
    // address typed at step one appeared here. Distinct step components make that
    // unrepresentable — this pins it, so a future merge back into one component fails loudly.
    expect(screen.getByLabelText('Cod de verificare')).toHaveValue('');
  });

  it('completes with the code and hands the operator up', async () => {
    const user = userEvent.setup();
    const account = { id: 'a', email: EMAIL, role: 'platform_administrator' } as const;
    completeMock.mockResolvedValue({ status: 'ok', value: account, messages: [] });
    renderScreen();
    await openChallenge(user);

    await user.type(screen.getByLabelText('Cod de verificare'), '287082');
    await user.click(screen.getByRole('button', { name: 'Continuă în consolă' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(account));
    expect(completeMock.mock.calls[0][0]).toEqual({ totpCode: '287082' });
  });

  it('renders a wrong code as received and stays on the factor step — the challenge survives', async () => {
    const user = userEvent.setup();
    completeMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/factor-invalid',
        status: 401,
        title: 'Cod de verificare incorect',
      },
    });
    renderScreen();
    await openChallenge(user);

    await user.type(screen.getByLabelText('Cod de verificare'), '000000');
    await user.click(screen.getByRole('button', { name: 'Continuă în consolă' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cod de verificare incorect');
    expect(screen.getByLabelText('Cod de verificare')).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('returns to the credential step when the challenge lapsed, with the refusal shown', async () => {
    const user = userEvent.setup();
    completeMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/authentication-required',
        status: 401,
        title: 'Autentificare necesară',
      },
    });
    renderScreen();
    await openChallenge(user);

    await user.type(screen.getByLabelText('Cod de verificare'), '287082');
    await user.click(screen.getByRole('button', { name: 'Continuă în consolă' }));

    await screen.findByRole('heading', { name: 'Autentificare operator' });
    expect(screen.getByRole('alert')).toHaveTextContent('Autentificare necesară');
  });

  it('blocks an empty credential submission client-side, with the UX-111 summary', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Continuă' }));

    expect(beginMock).not.toHaveBeenCalled();
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Câteva câmpuri au nevoie de atenție');
    expect(summary.querySelector('a[href="#admin-sign-in-password"]')).not.toBeNull();
  });

  it('lets the operator change account from the factor step', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openChallenge(user);

    await user.click(screen.getByRole('button', { name: 'Folosește alt cont' }));

    expect(screen.getByRole('heading', { name: 'Autentificare operator' })).toBeInTheDocument();
    // …with nothing prefilled. "Use a different account" means the previous address is exactly
    // what must not come back, and a password has no reason to outlive the step that took it —
    // the step's form unmounts with it, and this is what makes that a decision rather than an
    // accident of where the `useForm` happens to sit.
    expect(screen.getByLabelText('Adresa de e-mail')).toHaveValue('');
    expect(screen.getByLabelText('Parolă')).toHaveValue('');
  });

  it('explains an unreachable api from the bundled catalogue', async () => {
    const user = userEvent.setup();
    beginMock.mockResolvedValue({ status: 'unreachable' });
    renderScreen();

    await user.type(screen.getByLabelText('Adresa de e-mail'), EMAIL);
    await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
    await user.click(screen.getByRole('button', { name: 'Continuă' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serverul nu poate fi contactat');
  });
});
