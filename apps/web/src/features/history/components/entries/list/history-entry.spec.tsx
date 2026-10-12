import type { ChangeEntry } from '@easyesg/contracts';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { HistoryEntry } from './history-entry';

const READER = '0192f000-0000-7000-8000-00000000a001';
const copy = ro.history;

const ENTRY: ChangeEntry = {
  at: Date.UTC(2026, 7, 4, 11, 31),
  actor: { accountId: '0192f000-0000-7000-8000-00000000a002', name: 'Dorin Mardari', removed: true },
  source: 'carried_forward',
  changes: [
    { field: null, from: '44', to: '47' },
    { field: 'Motivul pentru care valoarea nu este disponibilă', from: null, to: 'Registrul se reface.' },
  ],
};

const draw = (entry: ChangeEntry, current = false) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
      <ol>
        <HistoryEntry entry={entry} readerAccountId={READER} current={current} />
      </ol>
    </NextIntlClientProvider>,
  );

/** One change on S-12 (task 84.2): its headline, its named fields, who, when and the source — the api's words, framed. */
describe('HistoryEntry', () => {
  it('heads with the subject’s own change, names every other field, and reads a missing side as a dash', () => {
    draw(ENTRY, true);
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('44 → 47');
    expect(within(item).getByText(copy.current)).toBeInTheDocument();
    expect(within(item).getByRole('term')).toHaveTextContent('Motivul pentru care valoarea nu este disponibilă');
    expect(within(item).getByRole('definition')).toHaveTextContent('— → Registrul se reface.');
    // The arrow is drawn for the eye; the sentence is what a screen reader says.
    expect(item).toHaveTextContent('din 44 în 47');
  });

  it('names a person since removed, marked so, and the change’s source beside its moment (UX-69)', () => {
    draw(ENTRY);
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Dorin Mardari');
    expect(within(item).getByText(copy.actor.removed)).toBeInTheDocument();
    expect(item).toHaveTextContent(copy.sources.carried_forward);
    expect(within(item).queryByText(copy.current)).toBeNull();
  });

  it('names the reader as themself, an erased account as one, and no person as the platform', () => {
    const { unmount } = draw({ ...ENTRY, actor: { accountId: READER, name: 'Ana Rusu', removed: false }, source: null });
    expect(screen.getByRole('listitem')).toHaveTextContent('Ana Rusu · dumneavoastră');
    expect(screen.queryByText(copy.actor.removed)).toBeNull();
    unmount();
    const erased = draw({ ...ENTRY, actor: { accountId: READER, name: null, removed: true } });
    expect(screen.getByRole('listitem')).toHaveTextContent(copy.actor.erased);
    erased.unmount();
    draw({ ...ENTRY, actor: null });
    expect(screen.getByRole('listitem')).toHaveTextContent(copy.actor.platform);
  });
});
