import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import type { ProfileFields } from '../../tools/profile-fields';
import { IdentitySection } from './identity-section';

/**
 * S-27's name fields against 182/6's shared rule (task 185): a part of spaces passes `required`, so what refuses it
 * before the save leaves is `namePartIsPresent`, the verdict the api's own profile save judges by.
 */
const PROFILE = {
  email: 'ana.rusu@example.md',
  givenName: 'Ana',
  familyName: 'Rusu',
  displayName: 'Ana Rusu',
  monogram: 'AR',
  jobTitle: null,
  phone: null,
  locale: 'ro',
  emailLocale: 'ro',
  exportLocale: 'ro',
} as const;

function Harness({ onSave }: { readonly onSave: () => void }) {
  const { control, handleSubmit } = useForm<ProfileFields>({
    defaultValues: {
      givenName: PROFILE.givenName,
      familyName: PROFILE.familyName,
      jobTitle: '',
      phone: '',
      locale: 'ro',
      emailLocale: 'ro',
      exportLocale: 'ro',
      switches: [],
    },
  });
  return (
    <form onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <IdentitySection control={control} profile={PROFILE} />
      <button type="submit">Salvați</button>
    </form>
  );
}

describe('S-27 · the name fields', () => {
  it.each([
    [ro.profile.identity.givenName, ro.profile.identity.familyName],
    [ro.profile.identity.familyName, ro.profile.identity.givenName],
  ])('refuses a %s of spaces inline, and saves nothing', async (blank, filled) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <Harness onSave={onSave} />
      </NextIntlClientProvider>,
    );

    await user.clear(screen.getByLabelText(blank));
    await user.type(screen.getByLabelText(blank), '   ');
    await user.click(screen.getByRole('button', { name: 'Salvați' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText(blank)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(filled)).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText(ro.profile.identity.nameBlank)).toHaveLength(1);
  });
});
