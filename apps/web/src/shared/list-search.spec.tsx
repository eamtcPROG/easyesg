import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { ListSearch } from './list-search';

const draw = (value: string, onSearchAction = vi.fn()) => {
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <ListSearch value={value} label="Căutați" onSearchAction={onSearchAction} />
    </NextIntlClientProvider>,
  );
  return onSearchAction;
};

describe('ListSearch (task 203.2)', () => {
  it('sends the typed term, trimmed, only when submitted', async () => {
    const user = userEvent.setup();
    const onSearch = draw('');
    await user.type(screen.getByRole('searchbox', { name: 'Căutați' }), '  Lina ');
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: ro.chrome.index.search.submit }));
    expect(onSearch).toHaveBeenCalledWith('Lina');
  });

  it('offers to clear a search in force, and not otherwise', async () => {
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: ro.chrome.index.search.clear })).toBeNull();
    const onSearch = draw('Lina');
    expect(screen.getByRole('searchbox', { name: 'Căutați' })).toHaveValue('Lina');
    await user.click(screen.getByRole('button', { name: ro.chrome.index.search.clear }));
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
