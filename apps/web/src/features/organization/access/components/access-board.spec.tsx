import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
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
import { AccessProvider } from './access-context';

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

/**
 * One retry, and only when the runner ran out of time — see the note on the suite below.
 *
 * `condition` takes a RegExp matched against the error message (Vitest 4.1.10). It must stay a
 * RegExp rather than a predicate if this is ever lifted into `vitest.config.ts`: the config is
 * serialised to the worker threads, so a function there is silently unusable.
 */
const RETRY_ON_STALL = { count: 1, condition: /timed out/u } as const;

/** What `i18n/request.ts` sets, and what NFR-34 makes load-bearing rather than incidental. */
const TIME_ZONE = 'Europe/Chisinau';
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

/**
 * The provider the app actually gives this island, restated because a jsdom test cannot inherit it.
 *
 * `NextIntlClientProviderServer` fills `formats`, `timeZone` and `now` from `getRequestConfig`
 * whenever the prop is `undefined` — so every Client Component in `apps/web` renders with
 * `i18n/formats.ts` and `Europe/Chisinau` in scope, and no layout passes either explicitly. A spec
 * that renders `NextIntlClientProvider` **directly** gets none of that inheritance, and the
 * consequence is not cosmetic: `format.dateTime(x, 'short')` threw `MISSING_FORMAT` on every date
 * cell of every row on every render, twenty-four times per run of this file, each one a caught
 * error with a full stack serialised to the reporter. The dates the table rendered were next-intl's
 * fallback rather than the format the product ships.
 *
 * So the test was passing against a configuration the application never produces. Naming the two
 * values here is what makes the rendered row the row a user sees — `timeZone` included, because
 * NFR-34 makes the zone the thing that decides which day an instant falls on, and a spec that
 * inherits the runner's zone asserts something that changes with the machine.
 */
const board = (given: readonly AccessRow[] = rows()) => (
  <NextIntlClientProvider
    locale="ro"
    formats={formats}
    timeZone={TIME_ZONE}
    messages={{ organization: ro.organization, chrome: ro.chrome, identity: ro.identity }}
  >
    <AccessProvider
      page={applyAccessView({ rows: given, view: DEFAULT_ACCESS_VIEW, now: NOW })}
      view={DEFAULT_ACCESS_VIEW}
      now={NOW}
      inviteAnchorId="invite"
    >
      <AccessBoard />
    </AccessProvider>
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

/**
 * Retried **only** on a timeout, and only here (26 Aug 2026).
 *
 * This test timed out once at 15 s during a `pnpm gates:clean` run and could not be reproduced in
 * six attempts. What the attempts measured is why the retry is shaped this way rather than as a
 * larger budget: alone the test costs ~470 ms, with all eight threads saturated 1771 ms, and in the
 * heaviest concurrent run that could be produced — `environment 177 s`, worse than the failing
 * run's 146 s — 3246 ms, still passing. The failure needed better than 32×, where the worst
 * reproducible contention gives 7×. It is a tail stall on a shared machine, not a budget that is
 * too small, and raising `testTimeout` a second time would be picking a number no measurement
 * supports.
 *
 * **The condition is what makes this safe.** A retry that fired on any error could hide a real
 * defect in the board; matched against the timeout message it cannot, because an assertion failure
 * does not match and fails on the first attempt. Nothing under test here is non-deterministic —
 * a pure reducer and a render, no timers, no network, no randomness — so a stall is the only thing
 * a second attempt can absorb.
 *
 * **What would make this the wrong answer:** a retry that starts passing on the second attempt
 * *regularly*, which would mean the test has become genuinely flaky rather than occasionally
 * starved. `retry` reports attempts, so that is visible rather than silent.
 */
describe('AccessBoard · per-row pending', () => {
  it('leaves the other rows usable while one row acts', { retry: RETRY_ON_STALL }, async () => {
    const user = userEvent.setup();
    // Never settles: the action stays in flight for the duration of the assertion. Measured at
    // zero cost — across 25 instrumented runs the click took 25 ms and the wait 2 ms — so the
    // shape is not what makes this test slow, and replacing it would buy nothing.
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
        formats={formats}
        timeZone={TIME_ZONE}
        messages={{ organization: ro.organization, chrome: ro.chrome, identity: ro.identity }}
      >
        <AccessProvider
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
        >
          <AccessBoard />
        </AccessProvider>
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Nicio persoană nu corespunde filtrelor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ștergeți filtrele' })).toBeInTheDocument();
  });
});
