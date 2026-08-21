import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import {
  PENDING_EMAIL_STORAGE_KEY,
  RESEND_SENT_AT_STORAGE_KEY,
} from '../constants';
import { resendVerificationAction, verifyEmailAction } from '../actions';
import { ConfirmEmail } from './confirm-email';
import { VerificationPending } from './verification-pending';

vi.mock('../actions', () => ({
  verifyEmailAction: vi.fn(),
  resendVerificationAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const verify = vi.mocked(verifyEmailAction);
const resend = vi.mocked(resendVerificationAction);

const withIntl = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="ro" messages={{ identity: ro.identity, chrome: ro.chrome }}>
    {node}
  </NextIntlClientProvider>
);

const EMAIL = 'ana.rusu@brutaria-lina.md';
const TOKEN = 'a'.repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('S-02 · confirm surface (?token=…)', () => {
  it('consumes the token only on the explicit action, never on render (task 19)', async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue({
      status: 'ok',
      value: { id: '018…', email: EMAIL, status: 'active' },
      messages: [],
    });
    render(withIntl(<ConfirmEmail token={TOKEN} />));

    // Rendering alone must not spend the single use — a mail scanner opened this URL.
    expect(verify).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmă adresa' }));
    await waitFor(() => expect(verify).toHaveBeenCalledWith({ token: TOKEN }));

    // Success confirms what happened and offers the next step (§8.1: never a bare toast).
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Adresa este confirmată');
    expect(screen.getByRole('link', { name: 'Mergi la autentificare' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('renders an invalid link as the API states it, with the resend route as the way out', async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/verification-token-invalid',
        status: 400,
        title: 'Linkul de confirmare nu este valid',
        detail: 'Acest link de confirmare nu mai este valid…',
      },
    });
    render(withIntl(<ConfirmEmail token={TOKEN} />));

    await user.click(screen.getByRole('button', { name: 'Confirmă adresa' }));

    const callout = await screen.findByRole('alert');
    expect(callout).toHaveTextContent('Linkul de confirmare nu este valid');
    expect(screen.getByRole('link', { name: 'Cere un link nou' })).toHaveAttribute(
      'href',
      '/verify',
    );
    // The failed link's surface still offers the button — the user may retry.
    expect(screen.getByRole('button', { name: 'Confirmă adresa' })).toBeEnabled();
  });
});

describe('S-02 · waiting/resend surface', () => {
  it('states the address the challenge went to, with resend paced by the cooldown', () => {
    sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, EMAIL);
    sessionStorage.setItem(RESEND_SENT_AT_STORAGE_KEY, String(Date.now()));
    render(withIntl(<VerificationPending />));

    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retrimite linkul' })).toBeDisabled();
    expect(screen.getByText(/Poți retrimite peste/)).toBeInTheDocument();
  });

  it('resends once the cooldown has passed, and confirms uniformly (OQ-55)', async () => {
    const user = userEvent.setup();
    resend.mockResolvedValue({ status: 'ok', value: null, messages: [] });
    sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, EMAIL);
    // A sentAt far in the past: the cooldown has long expired.
    sessionStorage.setItem(RESEND_SENT_AT_STORAGE_KEY, '0');
    render(withIntl(<VerificationPending />));

    await user.click(screen.getByRole('button', { name: 'Retrimite linkul' }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith({ email: EMAIL }));
    // The confirmation reveals nothing the uniform 202 does not.
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Dacă adresa are un cont care așteaptă confirmarea');
  });

  it('degrades to the resend form when no address is known', async () => {
    const user = userEvent.setup();
    resend.mockResolvedValue({ status: 'ok', value: null, messages: [] });
    render(withIntl(<VerificationPending />));

    const field = screen.getByLabelText('Adresa de e-mail');
    await user.type(field, EMAIL);
    await user.click(screen.getByRole('button', { name: 'Trimite linkul' }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith({ email: EMAIL }));
    // The address is remembered, so the screen converges to the waiting state.
    await waitFor(() => expect(screen.getByText(EMAIL)).toBeInTheDocument());
  });
});
