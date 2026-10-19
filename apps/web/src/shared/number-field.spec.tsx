import type { Locale } from '@easyesg/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { formats } from '@/i18n/formats';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { NumberField } from './number-field';

const MESSAGES = { ro, en } as const;
const INVALID = 'Nu este un număr.';

/** Formats and a time zone passed explicitly: a provider mounted here inherits neither (`apps/web/CLAUDE.md`'s trap). */
const draw = (input: { value: string; onCommit?: (value: string | null) => string | null; locale?: 'ro' | 'en' }) => {
  const onCommit = vi.fn(input.onCommit ?? (() => null));
  const locale: Locale = input.locale ?? 'ro';
  render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} formats={formats} timeZone="Europe/Chisinau">
      <NumberField label="Cifra" value={input.value} invalidWords={INVALID} onCommit={onCommit} />
    </NextIntlClientProvider>,
  );
  return { onCommit, field: screen.getByRole('textbox', { name: 'Cifra' }) };
};

describe('NumberField (task 220)', () => {
  it('shows a stored number in the reader’s format at rest, and plainly while edited', async () => {
    const user = userEvent.setup();
    const { field } = draw({ value: '1240.5' });
    expect(field).toHaveValue('1.240,5');
    await user.click(field);
    expect(field).toHaveValue('1240,5');
  });

  it('lays a stored number out in each language’s own marks', () => {
    const { field } = draw({ value: '1240.5', locale: 'en' });
    expect(field).toHaveValue('1,240.5');
  });

  it('asks which was meant where the text reads two ways, and hands on nothing until one is chosen', async () => {
    const user = userEvent.setup();
    const { field, onCommit } = draw({ value: '' });
    await user.type(field, '1.240');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/se poate citi în două feluri/u)).toBeInTheDocument();
    const meant = screen.getByRole('group', { name: ro.forms.number.choose });
    const answers = [...meant.querySelectorAll('button')].map((button) => button.textContent);
    expect(answers).toEqual(['1.240', '1,24']);

    await user.click(screen.getByRole('button', { name: '1,24' }));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('1.24');
    expect(field).toHaveValue('1,24');
    expect(screen.queryByRole('group', { name: ro.forms.number.choose })).toBeNull();
  });

  it('hands on the canonical decimal of a number the language settles', async () => {
    const user = userEvent.setup();
    const { field, onCommit } = draw({ value: '' });
    await user.type(field, '1.240,50');
    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('1240.50');
    expect(field).toHaveValue('1.240,50');
  });

  it('keeps a text that is not a number, says so in the caller’s words, and hands on nothing', async () => {
    const user = userEvent.setup();
    const { field, onCommit } = draw({ value: '' });
    await user.type(field, 'circa 5');
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(field).toHaveValue('circa 5');
    expect(screen.getByText(INVALID)).toBeInTheDocument();
  });

  it('keeps the text and shows the caller’s refusal where it refuses what was read', async () => {
    const user = userEvent.setup();
    const { field } = draw({ value: '', onCommit: () => 'Nicio factură nu are o cifră negativă.' });
    await user.type(field, '-3');
    await user.tab();
    expect(field).toHaveValue('-3');
    expect(screen.getByText('Nicio factură nu are o cifră negativă.')).toBeInTheDocument();
  });
});
