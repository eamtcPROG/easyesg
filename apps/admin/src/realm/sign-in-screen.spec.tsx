import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { signIn } from './session';
import { SignInScreen } from './sign-in-screen';

/**
 * A-01 against the real Romanian catalogue. The session module is the mocked seam; under test
 * are the screen's own duties — the three-field submission, the UX-111 summary, and rendering
 * the api's resolved refusals as received (this screen branches on nothing: factor, lockout
 * and throttle arrive already worded, task 23).
 */
vi.mock('./session', () => ({
  signIn: vi.fn(),
}));

const signInMock = vi.mocked(signIn);

const onSignedIn = vi.fn();

const renderScreen = () =>
  render(
    <IntlProvider
      locale={CONSOLE_LOCALE}
      messages={ro}
      formats={formats}
      timeZone={CONSOLE_TIME_ZONE}
    >
      <SignInScreen onSignedIn={onSignedIn} />
    </IntlProvider>,
  );

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Adresa de e-mail'), 'operator@easyesg.md');
  await user.type(screen.getByLabelText('Parolă'), 'Parola123!');
  await user.type(screen.getByLabelText('Cod de verificare'), '287082');
  await user.click(screen.getByRole('button', { name: 'Intră în consolă' }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-01 · admin sign-in screen', () => {
  it('submits all three factors and hands the operator up on success', async () => {
    const user = userEvent.setup();
    const account = {
      id: 'a',
      email: 'operator@easyesg.md',
      role: 'platform_administrator',
    } as const;
    signInMock.mockResolvedValue({ status: 'ok', value: account, messages: [] });
    renderScreen();

    await fillAndSubmit(user);

    expect(signInMock).toHaveBeenCalledWith({
      email: 'operator@easyesg.md',
      password: 'Parola123!',
      totpCode: '287082',
    });
    expect(onSignedIn).toHaveBeenCalledWith(account);
  });

  it('blocks an empty submission client-side — the code is not optional (FR-75)', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Intră în consolă' }));

    expect(signInMock).not.toHaveBeenCalled();
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Câteva câmpuri au nevoie de atenție');
    expect(summary.querySelector('a[href="#admin-sign-in-totp"]')).not.toBeNull();
  });

  it('renders the api’s resolved refusal as received — no client-side sentence for a slug', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/factor-invalid',
        status: 401,
        title: 'Cod de verificare incorect',
      },
    });
    renderScreen();

    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cod de verificare incorect');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('explains an unreachable api from the bundled catalogue', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ status: 'unreachable' });
    renderScreen();

    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serverul nu poate fi contactat');
  });
});
