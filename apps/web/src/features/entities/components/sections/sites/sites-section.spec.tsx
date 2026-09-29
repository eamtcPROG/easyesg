import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { CreateReportingEntityRequest, ReportingEntity } from '@easyesg/contracts';
import ro from '@/messages/ro.json';
import { ENTITY_STANDING } from '../../../tools/entities';
import { toFields, toRequest, type EntityFields } from '../../../tools/entity-fields';
import { SitesSection } from './sites-section';

/**
 * S-13's sites as a reader adds, removes and takes a removal back (project owner, 28 Sep 2026), against the real
 * Romanian catalogue and a real form — the rows are react-hook-form's, and what they send is `toRequest`'s. The
 * boundary's subsidiaries are the same parts over the other collection; these cases hold the parts.
 */
const stored = (name: string, id: string) => ({
  id,
  name,
  addressLine1: null,
  locality: null,
  postalCode: null,
  countryCode: null,
  latitude: null,
  longitude: null,
});

const ENTITY: ReportingEntity = {
  id: 'e1',
  name: 'Brutăria Lina SRL',
  legalForm: null,
  naceCodes: [],
  status: ENTITY_STANDING.ACTIVE,
  archivedAt: null,
  consolidationBasis: null,
  consolidationMembers: [],
  sites: [stored('Depozit Strășeni', 's1'), stored('Sediu', 's2')],
  createdAt: 1_788_000_000_000,
  updatedAt: 1_788_000_000_000,
};

function Harness({
  entity,
  archived = false,
  onSave,
}: {
  readonly entity: ReportingEntity | null;
  readonly archived?: boolean;
  readonly onSave: (request: CreateReportingEntityRequest) => void;
}) {
  const { control, handleSubmit } = useForm<EntityFields>({ mode: 'onTouched', defaultValues: toFields(entity) });
  return (
    <form onSubmit={(event) => void handleSubmit((fields) => onSave(toRequest(fields, [])))(event)}>
      <SitesSection control={control} archived={archived} />
      <button type="submit">Salvează</button>
    </form>
  );
}

const renderSites = (entity: ReportingEntity | null, archived = false) => {
  const onSave = vi.fn<(request: CreateReportingEntityRequest) => void>();
  render(
    <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
      <Harness entity={entity} archived={archived} onSave={onSave} />
    </NextIntlClientProvider>,
  );
  return { onSave, user: userEvent.setup() };
};

const sitesSent = (onSave: ReturnType<typeof vi.fn>) =>
  (onSave.mock.calls[0]?.[0] as CreateReportingEntityRequest | undefined)?.sites?.map((site) => site.name);

describe('S-13 · sites', () => {
  it('names each row by its site and counts the sites in the heading', () => {
    renderSites(ENTITY);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Amplasamente · 2');
    // Each row is a group named by its header line, which is what a screen reader announces on entering it.
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Depozit Strășeni' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sediu' })).toBeInTheDocument();
  });

  it('opens a new row with focus in its name, named by its position until it has a name', async () => {
    const { user } = renderSites(ENTITY);

    await user.click(screen.getByRole('button', { name: 'Adăugați un amplasament' }));

    const added = screen.getByRole('group', { name: 'Amplasamentul 3' });
    expect(within(added).getByLabelText('Denumirea amplasamentului')).toHaveFocus();
  });

  it('collapses a stored site to its undo, and the save leaves it out', async () => {
    const { user, onSave } = renderSites(ENTITY);

    await user.click(screen.getByRole('button', { name: 'Ștergeți amplasamentul Depozit Strășeni' }));

    // The row is a line now, its undo holding the focus the removal had — and it still counts nowhere.
    expect(screen.getByText('„Depozit Strășeni” va fi șters când salvați modificările.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anulați' })).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Depozit Strășeni' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Amplasamente · 1');

    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(sitesSent(onSave)).toEqual(['Sediu']);
  });

  it('takes a removal back with what was typed in the row, and puts focus in its name', async () => {
    const { user, onSave } = renderSites(ENTITY);
    const field = within(screen.getByRole('group', { name: 'Sediu' })).getByLabelText('Denumirea amplasamentului');
    await user.clear(field);
    await user.type(field, 'Sediul central');

    await user.click(screen.getByRole('button', { name: 'Ștergeți amplasamentul Sediul central' }));
    await user.click(screen.getByRole('button', { name: 'Anulați' }));

    const restored = screen.getByRole('group', { name: 'Sediul central' });
    expect(within(restored).getByLabelText('Denumirea amplasamentului')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(sitesSent(onSave)).toEqual(['Depozit Strășeni', 'Sediul central']);
  });

  it('takes no focus when the removal is pressed, so a blank name is never judged on the way out', async () => {
    // 29 Sep 2026: pressing the removal took focus from the blank name, which showed its message; the row grew and the
    // removal moved from under the pointer, so the click never landed. jsdom has no layout to move, so this holds the
    // press down and asserts the cause: the field keeps focus and says nothing while the button is held.
    const { user } = renderSites(ENTITY);
    await user.click(screen.getByRole('button', { name: 'Adăugați un amplasament' }));
    const name = within(screen.getByRole('group', { name: 'Amplasamentul 3' })).getByLabelText('Denumirea amplasamentului');
    const remove = screen.getByRole('button', { name: 'Ștergeți amplasamentul Amplasamentul 3' });

    await user.pointer({ keys: '[MouseLeft>]', target: remove });
    expect(name).toHaveFocus();
    expect(screen.queryByText(/Scrieți denumirea amplasamentului/)).toBeNull();

    await user.pointer({ keys: '[/MouseLeft]', target: remove });
    expect(screen.queryByRole('group', { name: 'Amplasamentul 3' })).toBeNull();
  });

  it('drops a site added since the last save outright, and returns focus to the add control', async () => {
    const { user, onSave } = renderSites(ENTITY);
    await user.click(screen.getByRole('button', { name: 'Adăugați un amplasament' }));

    await user.click(screen.getByRole('button', { name: 'Ștergeți amplasamentul Amplasamentul 3' }));

    expect(screen.queryByRole('button', { name: 'Anulați' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adăugați un amplasament' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(sitesSent(onSave)).toEqual(['Depozit Strășeni', 'Sediu']);
  });

  it('does not let a removed row’s refusal stop the save', async () => {
    // A stored site blanked is refused; removed, it is no longer the reader's to fix, and the save goes.
    const { user, onSave } = renderSites(ENTITY);
    await user.clear(within(screen.getByRole('group', { name: 'Sediu' })).getByLabelText('Denumirea amplasamentului'));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ștergeți amplasamentul Amplasamentul 2' }));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(sitesSent(onSave)).toEqual(['Depozit Strășeni']);
  });

  it('says so when there are none, and offers no change while archived', () => {
    renderSites({ ...ENTITY, sites: [] }, true);

    expect(screen.getByText('Niciun amplasament înregistrat.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adăugați un amplasament' })).toBeNull();
  });
});
