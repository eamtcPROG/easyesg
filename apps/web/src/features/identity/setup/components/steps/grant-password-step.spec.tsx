import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { setFirstPasswordByGrantAction } from '../../actions/actions';
import { SETUP_GRANT_LAPSED } from '../../tools/password-step';
import { GrantPasswordStep } from './grant-password-step';

vi.mock('../../actions/actions', () => ({
  setFirstPasswordByGrantAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const submit = vi.mocked(setFirstPasswordByGrantAction);

const withIntl = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="ro" messages={{ identity: ro.identity, forms: ro.forms }}>
    {node}
  </NextIntlClientProvider>
);

const EMAIL = 'ion.rusu@example.md';
const PASSWORD = 'Parola-Noua1!';
const REMEMBER = 'Țineți-mă autentificat pe acest dispozitiv';

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * S-36's password step on S-02's path (task 155) — what only this arm does, and what no browser
 * journey reaches without contriving the clock: the *keep me signed in* answer riding the submission,
 * and the lapsed notice drawn in place of the form once the grant has run out.
 */
describe('S-36 · the password step a confirmation link opens', () => {
  it('names the address, and sends the password with the keep-me-signed-in answer', async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue(undefined);
    render(withIntl(<GrantPasswordStep email={EMAIL} />));

    expect(screen.getByText(EMAIL, { exact: false })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Parola', { selector: 'input' }), PASSWORD);
    await user.click(screen.getByRole('checkbox', { name: REMEMBER }));
    await user.click(screen.getByRole('button', { name: 'Salvați parola' }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith({ password: PASSWORD, remember: true }));
  });

  it('asks for the shorter lifetime unless the box is ticked', async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue(undefined);
    render(withIntl(<GrantPasswordStep email={EMAIL} />));

    await user.type(screen.getByLabelText('Parola', { selector: 'input' }), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Salvați parola' }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith({ password: PASSWORD, remember: false }));
  });

  it('replaces the form with the lapsed notice once the grant has run out', async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ status: SETUP_GRANT_LAPSED });
    render(withIntl(<GrantPasswordStep email={EMAIL} />));

    await user.type(screen.getByLabelText('Parola', { selector: 'input' }), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Salvați parola' }));

    expect(await screen.findByText('Pasul pentru parolă s-a închis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvați parola' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Mergeți la autentificare' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });
});
