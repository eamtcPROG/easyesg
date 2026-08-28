import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { PENDING_EMAIL_STORAGE_KEY } from '../constants';
import { signInAction } from '../actions';
import { SignInForm } from './sign-in-form';

/**
 * S-01's sign-in surface, against the real Romanian catalogue. The action is the mocked seam
 * (`use server` modules import `server-only`); what is under test is the screen's four error
 * shapes — uniform, throttled, unverified, locked — and the hand-offs each one makes.
 */
vi.mock('../actions', () => ({
  signInAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const action = vi.mocked(signInAction);

const renderForm = (returnTo?: string) =>
  render(
    <NextIntlClientProvider locale="ro" messages={{ identity: ro.identity, chrome: ro.chrome, forms: ro.forms }}>
      <SignInForm returnTo={returnTo} />
    </NextIntlClientProvider>,
  );

const EMAIL = 'ana.rusu@brutaria-lina.md';
const PASSWORD = 'Parola123!';

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Adresa de e-mail'), EMAIL);
  await user.type(screen.getByLabelText('Parolă'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Intrați în cont' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('S-01 · sign-in form', () => {
  it('hands the credentials and the return target to the action, and renders nothing on success', async () => {
    const user = userEvent.setup();
    // The redirect won: the action resolves undefined and the screen is already unmounting.
    action.mockResolvedValue(undefined);
    renderForm('/reports?page=2');

    await fillAndSubmit(user);

    expect(action).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      returnTo: '/reports?page=2',
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocks an empty submission client-side — nothing leaves, the UX-111 summary links the fields', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Intrați în cont' }));

    expect(action).not.toHaveBeenCalled();
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Câteva câmpuri au nevoie de atenție');
    // The link resolves to the field's OWN id — the property `@easyesg/ui/forms` guarantees, and
    // the one the hand-kept copies (constant, `id=`, summary entry) used to break silently on a
    // rename. Read off the DOM, not pinned to a literal: what must hold is that they agree.
    const passwordFieldId = screen.getByLabelText('Parolă').id;
    expect(passwordFieldId).not.toBe('');
    expect(summary.querySelector(`a[href="#${passwordFieldId}"]`)).not.toBeNull();
  });

  it('renders the uniform failure as received — one document for unknown address and wrong password (NFR-64)', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/credential-invalid',
        status: 401,
        title: 'Autentificare nereușită',
        detail: 'Adresa sau parola nu este corectă.',
      },
    });
    renderForm();

    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Autentificare nereușită');
    expect(alert).toHaveTextContent('Adresa sau parola nu este corectă.');
  });

  it('routes the unverified answer to the resend challenge with the address handed off (OQ-57)', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/email-unverified',
        status: 403,
        title: 'Adresă neconfirmată',
      },
    });
    renderForm();

    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('a[href="/verify"]')).not.toBeNull();
    // The S-02 challenge reads the address from the same store registration writes.
    expect(sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY)).toBe(EMAIL);
  });

  it('routes the locked answer to the reset request — the only release before Phase 8', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/account-locked',
        status: 403,
        title: 'Cont blocat temporar',
      },
    });
    renderForm();

    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('a[href="/reset"]')).not.toBeNull();
    expect(sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY)).toBeNull();
  });
});
