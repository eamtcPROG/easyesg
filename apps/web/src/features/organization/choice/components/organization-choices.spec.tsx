import type { AccountMembership } from '@easyesg/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import ro from '@/messages/ro.json';
import { chooseOrganizationAction } from '../actions/actions';
import { OrganizationChoices } from './organization-choices';

/**
 * S-37's list against a stubbed action (task 83.3). The browser suite drives the choice end to end; what is
 * pinned here is what a journey reaches only by contriving a race — a refusal shown as the API worded it,
 * the catalogue's copy when no answer arrived, the list read again after either, and every row held while a
 * choice is on its way.
 *
 * **Mounted under a provider carrying the whole `organization` namespace**, because the list reads its own
 * words from two of its children — `choice` and `access.roles` (task 158) — and next-intl treats `messages`
 * as atomic: a subset naming only `choice` would render every role as an empty string.
 */
vi.mock('../actions/actions', () => ({ chooseOrganizationAction: vi.fn() }));

const refresh = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ refresh }) }));

const membership = (organizationId: string, organizationName: string, role: AccountMembership['role']) =>
  ({
    id: `m-${organizationId}`,
    organizationId,
    organizationName,
    role,
    joinedAt: 1_787_000_000_000,
    active: false,
  }) satisfies AccountMembership;

const MEMBERSHIPS = [
  membership('org-a', 'Alfa SRL', 'editor'),
  membership('org-b', 'Beta SRL', 'organization_administrator'),
];

const WORDS = ro.organization.choice;

const renderChoices = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
      <OrganizationChoices memberships={MEMBERSHIPS} returnTo="/reports" />
    </NextIntlClientProvider>,
  );

const rowFor = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('the organization choices (S-37, task 83.3)', () => {
  beforeEach(() => {
    vi.mocked(chooseOrganizationAction).mockReset();
    refresh.mockReset();
  });

  it('offers each organization once, named with the role held in it', () => {
    renderChoices();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(rowFor('Alfa SRL')).toHaveTextContent('Editare');
    expect(rowFor('Beta SRL')).toHaveTextContent('Administrator al organizației');
    expect(screen.getByRole('list', { name: WORDS.listLabel })).toBeInTheDocument();
  });

  it('sends the organization chosen and the address to go on to, and says nothing of its own', async () => {
    vi.mocked(chooseOrganizationAction).mockResolvedValue(undefined);
    renderChoices();

    await userEvent.click(rowFor('Beta SRL'));

    await waitFor(() => expect(rowFor('Beta SRL')).toBeEnabled());
    expect(chooseOrganizationAction).toHaveBeenCalledWith({ organizationId: 'org-b', returnTo: '/reports' });
    expect(screen.queryByText(WORDS.unreachable.title)).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows a refusal in the API’s own words, and reads the list again', async () => {
    vi.mocked(chooseOrganizationAction).mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: {
        type: 'https://easyesg.md/problems/not-found',
        status: 404,
        title: 'Nu a fost găsit',
        detail: 'Contul dumneavoastră nu face parte din organizația aleasă.',
      },
    });
    renderChoices();

    await userEvent.click(rowFor('Alfa SRL'));

    expect(await screen.findByText('Nu a fost găsit')).toBeInTheDocument();
    expect(screen.getByText('Contul dumneavoastră nu face parte din organizația aleasă.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('says so in its own words when no answer arrived', async () => {
    vi.mocked(chooseOrganizationAction).mockResolvedValue({ status: API_OUTCOME.Unreachable });
    renderChoices();

    await userEvent.click(rowFor('Alfa SRL'));

    expect(await screen.findByText(WORDS.unreachable.title)).toBeInTheDocument();
    expect(screen.getByText(WORDS.unreachable.body)).toBeInTheDocument();
  });

  it('holds every row while a choice is on its way', async () => {
    vi.mocked(chooseOrganizationAction).mockReturnValue(new Promise(() => undefined));
    renderChoices();

    await userEvent.click(rowFor('Alfa SRL'));

    await waitFor(() => expect(rowFor('Beta SRL')).toBeDisabled());
    expect(rowFor('Alfa SRL')).toBeDisabled();
  });
});
