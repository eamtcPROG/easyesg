import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ANSWER_MAX_LENGTH } from '@easyesg/validation';
import ro from '@/messages/ro.json';
import { NotAvailableDeclaration } from './not-available';

/**
 * UX-15's declaration at the text bound (task 259): a reason the write would refuse is said at the field and not
 * offered for confirmation. Mounted under the field namespace's provider, as the control reads its own words.
 */
const WORDS = ro.organization.wizard.field.notAvailable;

const opened = async () => {
  const onDeclare = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
      <NotAvailableDeclaration declared={false} onDeclare={onDeclare} onResume={() => undefined} />
    </NextIntlClientProvider>,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: WORDS.declare }));
  return { onDeclare, reason: screen.getByRole('textbox', { name: WORDS.reason }) };
};

describe('NotAvailableDeclaration — the text bound (task 259)', () => {
  it('offers a reason of exactly the bound for confirmation, and sends it', async () => {
    const { onDeclare, reason } = await opened();
    fireEvent.change(reason, { target: { value: 'r'.repeat(ANSWER_MAX_LENGTH) } });

    const confirm = screen.getByRole('button', { name: WORDS.confirm });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onDeclare).toHaveBeenCalledWith('r'.repeat(ANSWER_MAX_LENGTH));
  });

  it('says one character past it at the field, and does not offer it', async () => {
    const { onDeclare, reason } = await opened();
    fireEvent.change(reason, { target: { value: 'r'.repeat(ANSWER_MAX_LENGTH + 1) } });

    expect(screen.getByText(/^Motivul depășește 32\.767 de caractere/u)).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: WORDS.confirm })).toBeDisabled();
    expect(onDeclare).not.toHaveBeenCalled();
  });
});
