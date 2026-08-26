import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { API_OUTCOME } from '@/lib/api-outcome';
import {
  ACCESS_PAGE_SIZE,
  applyAccessView,
  DEFAULT_ACCESS_VIEW,
  toAccessRows,
  type AccessRow,
} from '../access';
import { resendInvitationAction } from '../actions';
import { AccessBoard } from './access-board';

/**
 * S-16's board, against stubbed actions.
 *
 * The browser suite drives the journeys; what is pinned here is the behaviour the refactor of
 * 26 Aug 2026 introduced and no journey asserts — **an action running on one row leaves the other
 * rows usable.** The first cut derived "busy" from `useTransition`'s pending flag, which is per
 * component, and the component was the whole board: pressing *resend* on one invitation greyed out
 * every control on every other row. Nothing failed, nothing logged, and a screenshot taken a moment
 * later looks identical.
 *
 * The empty states are here for the same reason — `matched` and `total` are two numbers because
 * they are two screens, and a browser test that seeds one organization only ever sees one of them.
 */
vi.mock('../actions', () => ({
  changeMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
  resendInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** jsdom implements neither, and Radix Select calls both while opening. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const resend = vi.mocked(resendInvitationAction);
const NOW = 1_780_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const rows = (): AccessRow[] =>
  toAccessRows({
    members: [
      {
        id: 'm-1',
        accountId: 'a-1',
        email: 'ana@example.md',
        role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
        status: 'active',
        lastActiveAt: NOW - DAY,
        joinedAt: NOW - 30 * DAY,
      },
    ],
    invitations: [
      { id: 'i-1', email: 'bogdan@example.md', role: MEMBERSHIP_ROLE.EDITOR, issuedAt: NOW - DAY, expiresAt: NOW + 6 * DAY },
      { id: 'i-2', email: 'corina@example.md', role: MEMBERSHIP_ROLE.VIEWER, issuedAt: NOW - DAY, expiresAt: NOW + 6 * DAY },
    ],
  });

const board = (given: readonly AccessRow[] = rows()) => (
  <NextIntlClientProvider
    locale="ro"
    messages={{ organization: ro.organization, chrome: ro.chrome, identity: ro.identity }}
  >
    <AccessBoard
      page={applyAccessView({ rows: given, view: DEFAULT_ACCESS_VIEW, now: NOW })}
      view={DEFAULT_ACCESS_VIEW}
      now={NOW}
      inviteAnchorId="invite"
    />
  </NextIntlClientProvider>
);

/**
 * The resend button belonging to one invited person's row.
 *
 * No `exact` option: Testing Library matches a role's accessible name as a whole string already, so
 * the role cell beside it — named "Rolul lui <address>" — does not match. That is the opposite of
 * the Playwright query in `e2e/web/users-access.spec.ts`, which needs `exact` because its default
 * is a substring match. Two libraries, two defaults, one address.
 */
const resendButtonFor = (email: string) =>
  screen
    .getByRole('cell', { name: email })
    .closest('tr')!
    .querySelector<HTMLButtonElement>('button:not([aria-haspopup])')!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccessBoard · per-row pending', () => {
  it('leaves the other rows usable while one row acts', async () => {
    const user = userEvent.setup();
    // Never settles: the action stays in flight for the duration of the assertion.
    resend.mockReturnValue(new Promise(() => undefined));
    render(board());

    const acting = resendButtonFor('bogdan@example.md');
    const other = resendButtonFor('corina@example.md');

    await user.click(acting);

    await waitFor(() => expect(acting).toBeDisabled());
    expect(other).toBeEnabled();
  });

  it('reports the outcome once the action settles', async () => {
    const user = userEvent.setup();
    resend.mockResolvedValue({ status: API_OUTCOME.Ok, value: null, messages: [] });
    render(board());

    await user.click(resendButtonFor('bogdan@example.md'));

    expect(await screen.findByText(/Am trimis din nou invitația/)).toBeInTheDocument();
    // The success notice carries all three parts NFR-79 requires, the "what now" included.
    expect(screen.getByText('Nu mai aveți nimic de făcut.')).toBeInTheDocument();
  });

  it("renders the API's own refusal rather than a sentence of its own", async () => {
    const user = userEvent.setup();
    resend.mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: {
        type: 'https://easyesg.md/problems/not-found',
        status: 404,
        title: 'Invitația nu mai există',
        detail: 'A fost anulată între timp. Reîncărcați lista.',
      },
    });
    render(board());

    await user.click(resendButtonFor('bogdan@example.md'));

    expect(await screen.findByText('Invitația nu mai există')).toBeInTheDocument();
    expect(screen.getByText('A fost anulată între timp. Reîncărcați lista.')).toBeInTheDocument();
  });
});

describe('AccessBoard · the two empty states', () => {
  /** No rows at all: nobody has been invited, and the one action is to invite someone. */
  it('offers the invitation form on first use', () => {
    render(board([]));
    expect(screen.getByText('Deocamdată sunteți singurul cu acces')).toBeInTheDocument();
  });

  /**
   * Rows behind a filter that matched none. Collapsing this into first use would tell an
   * administrator with colleagues that they are alone — which is why the read model reports
   * `matched` and `total` separately rather than one length.
   */
  it('offers to clear the filters when a filter emptied the list', () => {
    const given = rows();
    render(
      <NextIntlClientProvider
        locale="ro"
        messages={{ organization: ro.organization, chrome: ro.chrome, identity: ro.identity }}
      >
        <AccessBoard
          page={{
            rows: [],
            matched: 0,
            total: given.length,
            page: 1,
            pageCount: 1,
            pageSize: ACCESS_PAGE_SIZE,
          }}
          view={DEFAULT_ACCESS_VIEW}
          now={NOW}
          inviteAnchorId="invite"
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Nicio persoană nu corespunde filtrelor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ștergeți filtrele' })).toBeInTheDocument();
  });
});
