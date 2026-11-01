import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { beginSignIn, completeSignIn, recoverSignIn } from '../../queries/session';
import { SignInScreen } from './sign-in-screen';

/**
 * A-01 against the real Romanian catalogue — the handshake as the screen carries it. The session
 * module is the mocked seam; under test are the screen's own duties: the staged flow (credential →
 * factor with the server-verified address shown), the UX-111 summaries, the api's refusals rendered
 * as received, and the branches it owns — a lapsed challenge sends the flow back to the credential
 * step, and since task 151 the recovery step opens from the factor step or from a lockout refusal.
 */
vi.mock('../../queries/session', () => ({
  beginSignIn: vi.fn(),
  completeSignIn: vi.fn(),
  recoverSignIn: vi.fn(),
}));

const beginMock = vi.mocked(beginSignIn);
const completeMock = vi.mocked(completeSignIn);
const recoverMock = vi.mocked(recoverSignIn);

const onSignedIn = vi.fn();
const onRecovered = vi.fn();

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
  return render(<SignInScreen onSignedIn={onSignedIn} onRecovered={onRecovered} />, { wrapper });
};

const EMAIL = 'operator@easyesg.md';
const RECOVERY_CODE = 'ABCD-EFGH-JKLM-NPQR';

const submitCredential = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Adresa de e-mail'), EMAIL);
  await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
  await user.click(screen.getByRole('button', { name: 'Continuați' }));
};

const openChallenge = async (user: ReturnType<typeof userEvent.setup>) => {
  beginMock.mockResolvedValue({
    status: 'ok',
    value: { email: EMAIL, expiresAt: Date.now() + 5 * 60 * 1000 },
    messages: [],
  });
  await submitCredential(user);
  await screen.findByRole('heading', { name: 'Confirmați al doilea factor' });
};

const openRecoveryFromFactor = async (user: ReturnType<typeof userEvent.setup>) => {
  await openChallenge(user);
  await user.click(screen.getByRole('button', { name: 'Folosiți un cod de recuperare' }));
  await screen.findByRole('heading', { name: 'Intrați cu un cod de recuperare' });
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
    await user.click(screen.getByRole('button', { name: 'Continuați în consolă' }));

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
    await user.click(screen.getByRole('button', { name: 'Continuați în consolă' }));

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
    await user.click(screen.getByRole('button', { name: 'Continuați în consolă' }));

    await screen.findByRole('heading', { name: 'Autentificare operator' });
    expect(screen.getByRole('alert')).toHaveTextContent('Autentificare necesară');
  });

  it('blocks an empty credential submission client-side, with the UX-111 summary', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Continuați' }));

    expect(beginMock).not.toHaveBeenCalled();
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Câteva câmpuri au nevoie de atenție');
    // The summary link resolves to the field's OWN id — the property `@easyesg/ui/forms` exists
    // to guarantee, and the one the three hand-kept copies (constant, `id=`, summary entry) used
    // to break silently on a rename. Read off the DOM rather than pinned to a literal: what must
    // hold is that they agree, not what they agree on.
    const passwordFieldId = screen.getByLabelText('Parolă').id;
    expect(passwordFieldId).not.toBe('');
    expect(summary.querySelector(`a[href="#${passwordFieldId}"]`)).not.toBeNull();
  });

  it('lets the operator change account from the factor step', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openChallenge(user);

    await user.click(screen.getByRole('button', { name: 'Folosiți alt cont' }));

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

    await submitCredential(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serverul nu poate fi contactat');
  });
});

describe('A-01 · the recovery sign-in (task 151)', () => {
  it('opens from the factor step for the verified address, asks for the password again, and hands the session up', async () => {
    const user = userEvent.setup();
    const session = {
      account: { id: 'a', email: EMAIL, role: 'platform_administrator' },
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      recoveryCodesRemaining: 9,
    } as const;
    recoverMock.mockResolvedValue({ status: 'ok', value: session, messages: [] });
    renderScreen();
    await openRecoveryFromFactor(user);

    expect(screen.getByLabelText('Adresa de e-mail')).toHaveValue(EMAIL);
    // Nothing from step one survives into this form: the credential step's form unmounted with it.
    expect(screen.getByLabelText('Parolă')).toHaveValue('');

    await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
    await user.type(screen.getByLabelText('Cod de recuperare'), RECOVERY_CODE);
    await user.click(screen.getByRole('button', { name: 'Intrați în consolă' }));

    await waitFor(() => expect(onRecovered).toHaveBeenCalledWith(session));
    expect(recoverMock.mock.calls[0][0]).toEqual({
      email: EMAIL,
      password: 'Parola123!',
      recoveryCode: RECOVERY_CODE,
    });
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('offers the recovery step on a lockout refusal, for the address that was refused', async () => {
    const user = userEvent.setup();
    beginMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/admin-account-locked',
        status: 403,
        title: 'Cont de operator blocat',
        detail: 'Contul a fost blocat după prea multe încercări eșuate.',
      },
    });
    renderScreen();
    await submitCredential(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cont de operator blocat');
    await user.click(within(alert).getByRole('button', { name: 'Intrați cu un cod de recuperare' }));

    expect(screen.getByRole('heading', { name: 'Intrați cu un cod de recuperare' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adresa de e-mail')).toHaveValue(EMAIL);
    // The refusal that offered the step has been acted on, so it goes.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers no recovery on any other refusal of the credential', async () => {
    const user = userEvent.setup();
    beginMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/credential-invalid',
        status: 401,
        title: 'Autentificarea nu a reușit',
        detail: 'Adresa sau parola nu sunt corecte.',
      },
    });
    renderScreen();
    await submitCredential(user);

    const alert = await screen.findByRole('alert');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps a refused recovery on its step with what was typed, the refusal as received', async () => {
    const user = userEvent.setup();
    recoverMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/credential-invalid',
        status: 401,
        title: 'Autentificarea nu a reușit',
        detail: 'Adresa, parola sau codul de recuperare nu sunt corecte ori codul a fost deja folosit.',
      },
    });
    renderScreen();
    await openRecoveryFromFactor(user);

    await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
    await user.type(screen.getByLabelText('Cod de recuperare'), RECOVERY_CODE);
    await user.click(screen.getByRole('button', { name: 'Intrați în consolă' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('codul a fost deja folosit');
    expect(screen.getByRole('heading', { name: 'Intrați cu un cod de recuperare' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cod de recuperare')).toHaveValue(RECOVERY_CODE);
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('returns from the recovery step to an empty credential step', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openRecoveryFromFactor(user);

    await user.click(screen.getByRole('button', { name: 'Folosiți alt cont' }));

    expect(screen.getByRole('heading', { name: 'Autentificare operator' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adresa de e-mail')).toHaveValue('');
  });
});
