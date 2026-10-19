import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ENTITY_STATUS } from '@easyesg/contracts';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { PERIODS_FROM } from '@/lib/periods-from';
import { entityPeriodsRoute, entityRoute } from '@/lib/routes';
import type { EntityRow } from '../../tools/entities';
import { EntityRowMenu } from './entity-row-menu';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

const ROW: EntityRow = {
  id: 'e1',
  name: 'Brutăria Lina SRL',
  legalForm: null,
  idno: null,
  codes: [],
  activity: [],
  siteCount: 1,
  consolidationBasis: null,
  standing: ENTITY_STATUS.ACTIVE,
  periods: [],
};

const WORDS = ro.organization.entities.rowActions;

const open = async (row: EntityRow) => {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
      <EntityRowMenu row={row} />
    </NextIntlClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: WORDS.menu.replace('{name}', row.name) }));
  return { user, items: screen.getAllByRole('menuitem') };
};

/** S-13's row ⋯ (19 Oct 2026, project owner): the row's actions in one menu, named for its entity. */
describe('EntityRowMenu', () => {
  it('offers the record to edit, then its periods, and opens each', async () => {
    const { user, items } = await open(ROW);
    expect(items.map((item) => item.textContent)).toEqual([WORDS.edit, WORDS.periods]);

    await user.click(items[1]);
    expect(push).toHaveBeenLastCalledWith(entityPeriodsRoute(ROW.id, PERIODS_FROM.ENTITIES));
  });

  it('offers an archived record to view rather than edit (FR-20)', async () => {
    const { user, items } = await open({ ...ROW, standing: ENTITY_STATUS.ARCHIVED });
    expect(items.map((item) => item.textContent)).toEqual([WORDS.view, WORDS.periods]);

    await user.click(items[0]);
    expect(push).toHaveBeenLastCalledWith(entityRoute(ROW.id));
  });
});
