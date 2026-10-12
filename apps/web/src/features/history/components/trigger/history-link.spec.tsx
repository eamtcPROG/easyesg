import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { HISTORY_SUBJECT } from '@/client/history/history-subject';
import { HistoryProvider } from '../provider/history-context';
import { HistoryLink } from './history-link';

vi.mock('@/client/history/use-change-history', () => ({
  useChangeHistory: () => ({ data: undefined, isError: false }),
}));

const REQUEST = { subject: { kind: HISTORY_SUBJECT.ORGANIZATION }, naming: 'Brutăria Lina SRL' } as const;

const draw = (withProvider: boolean, count?: number) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Chisinau">
      {withProvider ? (
        <HistoryProvider organizationId="o-1" readerAccountId="a-1">
          <HistoryLink request={REQUEST} count={count} />
        </HistoryProvider>
      ) : (
        <HistoryLink request={REQUEST} count={count} />
      )}
    </NextIntlClientProvider>,
  );

/** S-12's way in (task 84.2): nothing without a provider — a reader who may not read the trail — and the panel with one. */
describe('HistoryLink', () => {
  it('draws nothing where the screen offers no history (182/22)', () => {
    const { container } = draw(false, 3);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts a field’s changes in its footer, and opens the panel named for what it is of', async () => {
    draw(true, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Modificat de 3 ori · istoric' }));
    const panel = screen.getByRole('dialog', { name: ro.history.title });
    expect(panel).toHaveTextContent('Brutăria Lina SRL');
    await userEvent.click(screen.getByRole('button', { name: ro.history.close }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Focus goes back to the field's footer it was opened from (UX-113), not to the top of the page.
    expect(screen.getByRole('button', { name: 'Modificat de 3 ori · istoric' })).toHaveFocus();
  });

  it('reads as the record’s way in where there is no count', () => {
    draw(true);
    expect(screen.getByRole('button', { name: ro.history.open })).toBeInTheDocument();
  });
});
