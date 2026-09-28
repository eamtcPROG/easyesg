import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { RESET_ADDRESS_STORAGE_KEY } from '../../shared/tools/constants';
import { requestPasswordResetAction } from '../actions/actions';
import { RequestResetForm } from './request-reset-form';

/**
 * S-02's reset request, against the real Romanian catalogue — what it does with the address S-01
 * carried (`design_spec.md` S-02, amended 28 Sep 2026). The action is the mocked seam (`use server`
 * modules import `server-only`); the uniform answer itself is `e2e/web/session.spec.ts`'s.
 */
vi.mock('../actions/actions', () => ({
  requestPasswordResetAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const action = vi.mocked(requestPasswordResetAction);

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={{ identity: ro.identity, chrome: ro.chrome, forms: ro.forms }}>
      <RequestResetForm />
    </NextIntlClientProvider>,
  );

const EMAIL = 'ana.rusu@brutaria-lina.md';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('S-02 · reset request form', () => {
  it('opens with the address carried from sign-in, and takes it so a later visit opens empty', async () => {
    sessionStorage.setItem(RESET_ADDRESS_STORAGE_KEY, EMAIL);
    renderForm();

    expect(await screen.findByDisplayValue(EMAIL)).toBe(screen.getByLabelText('Adresa de e-mail'));
    expect(sessionStorage.getItem(RESET_ADDRESS_STORAGE_KEY)).toBeNull();
  });

  it('opens empty when nothing was carried', () => {
    renderForm();

    expect(screen.getByLabelText('Adresa de e-mail')).toHaveValue('');
  });

  /** The prefill is the form's value, not only the input's — what is shown is what is sent. */
  it('sends the carried address without it being typed again', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({ status: 'ok', value: null, messages: [] });
    sessionStorage.setItem(RESET_ADDRESS_STORAGE_KEY, EMAIL);
    renderForm();

    await screen.findByDisplayValue(EMAIL);
    await user.click(screen.getByRole('button', { name: 'Trimiteți linkul' }));

    expect(action).toHaveBeenCalledWith({ email: EMAIL });
    expect(await screen.findByText('Cererea a fost înregistrată')).toBeInTheDocument();
  });

  it('keeps the carried address editable — a mistyped one is corrected here, not re-carried', async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({ status: 'ok', value: null, messages: [] });
    sessionStorage.setItem(RESET_ADDRESS_STORAGE_KEY, 'ana.rusu@brutaria-lina.m');
    renderForm();

    const field = await screen.findByDisplayValue('ana.rusu@brutaria-lina.m');
    await user.type(field, 'd');
    await user.click(screen.getByRole('button', { name: 'Trimiteți linkul' }));

    expect(action).toHaveBeenCalledWith({ email: EMAIL });
  });
});
