import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { RecoveredStage } from './recovered-stage';

/**
 * The dialogue's last stage after a recovery code (task 190; UC-195 step 3): the count's three readings, S-28 offered
 * in a new tab so the step is kept (UX-38), and *continue* as the one thing that resumes.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const copy = ro.identity.reauthenticate.recovered;

const draw = (remaining: number | null, onContinue = vi.fn()) => {
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <RecoveredStage remaining={remaining} onContinue={onContinue} />
    </NextIntlClientProvider>,
  );
  return onContinue;
};

describe('the dialogue after a recovery code', () => {
  it('states the codes left', () => {
    draw(4);
    expect(screen.getByText(copy.body.replace('{remaining}', '4'))).toBeVisible();
  });

  it('says what zero means rather than stating a count of none', () => {
    draw(0);
    expect(screen.getByText(copy.bodyNone)).toBeVisible();
    expect(screen.queryByText(copy.body.replace('{remaining}', '0'))).toBeNull();
  });

  it('guesses no count when the read failed', () => {
    draw(null);
    expect(screen.getByText(copy.bodyUnread)).toBeVisible();
  });

  it('opens S-28 in a new tab, and resumes only on continue', async () => {
    const onContinue = draw(4);
    const manage = screen.getByRole('link', { name: copy.manage });
    expect(manage).toHaveAttribute('href', '/account/credentials');
    expect(manage).toHaveAttribute('target', '_blank');
    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: copy.continue }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
