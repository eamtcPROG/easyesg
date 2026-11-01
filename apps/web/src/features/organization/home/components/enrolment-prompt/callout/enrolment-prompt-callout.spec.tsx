import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { API_OUTCOME } from '@/lib/api-outcome';
import { dismissEnrolmentPromptAction } from '../../../actions/actions';
import { EnrolmentPromptCallout } from './enrolment-prompt-callout';

/**
 * S-05's prompt to enrol (task 190): the two ways on, and *not now*'s refusal — which keeps the prompt and says why,
 * in the api's words when it sent any. Its success needs no case here: the prompt goes because S-05 is re-read, which
 * `e2e/web/home.spec.ts` drives in a browser.
 */
vi.mock('../../../actions/actions', () => ({ dismissEnrolmentPromptAction: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const action = vi.mocked(dismissEnrolmentPromptAction);
const copy = ro.organization.home.enrolmentPrompt;

const draw = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <EnrolmentPromptCallout />
    </NextIntlClientProvider>,
  );

beforeEach(() => vi.clearAllMocks());

describe('S-05 · the second-factor prompt', () => {
  it('leads to S-28 and offers not now', () => {
    draw();
    expect(screen.getAllByText(copy.title)).toHaveLength(1);
    expect(screen.getByRole('link', { name: copy.setUp })).toHaveAttribute('href', '/account/credentials');
    expect(screen.getAllByRole('button', { name: copy.notNow })).toHaveLength(1);
  });

  it('keeps the prompt and shows the api’s own refusal when not now is refused', async () => {
    action.mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: { type: 'about:blank', status: 500, title: 'Titlul api-ului', detail: 'Detaliul api-ului' },
    });
    draw();
    await userEvent.click(screen.getByRole('button', { name: copy.notNow }));

    expect(await screen.findByText('Detaliul api-ului')).toBeVisible();
    expect(screen.getAllByText(copy.title)).toHaveLength(1);
  });

  it('says so in its own words when no answer arrived', async () => {
    action.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    draw();
    await userEvent.click(screen.getByRole('button', { name: copy.notNow }));

    expect(await screen.findByText(copy.notNowFailedBody)).toBeVisible();
    expect(screen.getAllByText(copy.title)).toHaveLength(1);
  });
});
