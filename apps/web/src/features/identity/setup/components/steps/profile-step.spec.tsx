import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { saveSetupProfileAction } from '../../actions/actions';
import { ProfileStep } from './profile-step';

/**
 * S-36's name step (task 155), against 182/6's shared rule since task 185: a part of spaces passes `required`, so what
 * refuses it inline is `namePartIsPresent`, the verdict the api's setup save judges by — and nothing leaves.
 */
vi.mock('../../actions/actions', () => ({ saveSetupProfileAction: vi.fn() }));
vi.mock('../shared/sign-out', () => ({ SignOut: () => null }));

const save = vi.mocked(saveSetupProfileAction);

const SETUP = {
  status: 'awaiting_setup',
  email: 'ion.rusu@example.md',
  givenName: 'Ion',
  familyName: 'Rusu',
  locale: 'ro',
  passwordSet: true,
} as const;

beforeEach(() => vi.clearAllMocks());

describe('S-36 · the name step', () => {
  it.each([
    ['Prenume', 'Nume de familie'],
    ['Nume de familie', 'Prenume'],
  ])('refuses a %s of spaces inline, and sends nothing', async (blank, filled) => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <ProfileStep setup={SETUP} />
      </NextIntlClientProvider>,
    );

    await user.clear(screen.getByLabelText(blank));
    await user.type(screen.getByLabelText(blank), '   ');
    await user.click(screen.getByRole('button', { name: ro.identity.setup.profileSubmit }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(blank)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(filled)).not.toHaveAttribute('aria-invalid', 'true');
    // Twice, and no more: beside the field and in the UX-111 summary that links to it.
    expect(screen.getAllByText(ro.identity.register.nameBlank)).toHaveLength(2);
  });
});
