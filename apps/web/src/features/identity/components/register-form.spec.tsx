import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { PENDING_EMAIL_STORAGE_KEY } from '../constants';
import { registerAction } from '../actions';
import { RegisterForm } from './register-form';

/**
 * S-01's register surface, against the REAL Romanian catalogue — the source locale is what the
 * keys are typed from, so a missing key fails here as an empty render rather than shipping.
 *
 * The server action and the router are the two seams mocked: the action because `use server`
 * modules import `server-only` (a build error in a client bundle, a throw here), the router
 * because navigation is Next's, not this form's.
 */
const push = vi.fn();

vi.mock('../actions', () => ({
  registerAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

const action = vi.mocked(registerAction);

const renderForm = () =>
  render(
    <NextIntlClientProvider
      locale="ro"
      messages={{ identity: ro.identity, chrome: ro.chrome }}
    >
      <RegisterForm />
    </NextIntlClientProvider>,
  );

const VALID_EMAIL = 'ana.rusu@brutaria-lina.md';
const VALID_PASSWORD = 'Parola123!';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('S-01 · register form', () => {
  it('displays the password policy before entry and answers it while typing (S-02 §5)', async () => {
    const user = userEvent.setup();
    renderForm();

    // Before entry: every requirement visible, none met.
    const list = screen.getAllByRole('list')[0];
    expect(list).toHaveTextContent('Între 8 și 128 de caractere');
    expect(screen.getAllByText(/încă neîndeplinit/)).toHaveLength(5);

    await user.type(screen.getByLabelText('Parolă'), VALID_PASSWORD);
    await waitFor(() => expect(screen.getAllByText(/— îndeplinit/)).toHaveLength(5));
  });

  it('enforces the policy on entry: no request leaves while a requirement is unmet', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('E-mail de serviciu'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Parolă'), 'parola123!'); // no uppercase
    await user.click(screen.getByRole('button', { name: 'Creează contul' }));

    expect(action).not.toHaveBeenCalled();
    // The three-part message inline, and the UX-111 summary linking to the field.
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Câteva câmpuri au nevoie de atenție');
    // The link resolves to the field's OWN id — see sign-in-form.spec.tsx: the agreement is the
    // property under test, not the literal the two sides used to be kept equal by hand.
    const passwordFieldId = screen.getByLabelText('Parolă').id;
    expect(passwordFieldId).not.toBe('');
    expect(summary.querySelector(`a[href="#${passwordFieldId}"]`)).not.toBeNull();
  });

  it('submits, stores the address for the S-02 challenge and exits to /verify', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({
      status: 'ok',
      value: { id: '01890000-0000-7000-8000-000000000000', email: VALID_EMAIL, status: 'unverified' },
      messages: [],
    });
    renderForm();

    await user.type(screen.getByLabelText('E-mail de serviciu'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Parolă'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Creează contul' }));

    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({ email: VALID_EMAIL, password: VALID_PASSWORD }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/verify'));
    expect(sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY)).toBe(VALID_EMAIL);
  });

  it('renders a 409 problem as received, with sign-in as the way out (OQ-53)', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/conflict',
        status: 409,
        title: 'Intră în conflict cu datele existente',
        detail: 'Există deja un cont pentru această adresă…',
      },
    });
    renderForm();

    await user.type(screen.getByLabelText('E-mail de serviciu'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Parolă'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Creează contul' }));

    const callout = await screen.findByRole('alert');
    // The API's resolved wording verbatim — the screen never re-derives it from a slug.
    expect(callout).toHaveTextContent('Intră în conflict cu datele existente');
    expect(callout).toHaveTextContent('Există deja un cont pentru această adresă…');
    expect(screen.getAllByRole('link', { name: 'Autentifică-te' }).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('explains an unreachable API from the bundled catalogue (OQ-43)', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({ status: 'unreachable' });
    renderForm();

    await user.type(screen.getByLabelText('E-mail de serviciu'), VALID_EMAIL);
    await user.type(screen.getByLabelText('Parolă'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Creează contul' }));

    const callout = await screen.findByRole('alert');
    expect(callout).toHaveTextContent('Serverul nu poate fi contactat');
    expect(callout).toHaveTextContent('Verifică-ți conexiunea la internet');
  });
});
