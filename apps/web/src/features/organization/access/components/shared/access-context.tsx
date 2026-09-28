'use client';

import { useTranslations } from 'next-intl';
import { ACCESS_MESSAGES } from './access-messages';
import {
  createContext,
  useCallback,
  use,
  useMemo,
  useReducer,
  useTransition,
} from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { noticeFromOutcome } from '@/lib/notice';
import { ROUTES, withQuery } from '@/lib/routes';
import { useRouter } from '@/i18n/navigation';
import {
  accessRowKey,
  accessViewQuery,
  type AccessPage,
  type AccessRow,
  type AccessView,
} from '../../tools/access';
import {
  ACCESS_EVENT,
  INITIAL_ACCESS_STATE,
  NOTICE_REGION,
  accessReducer,
  type AccessState,
  type Confirmation,
  type PlacedNotice,
} from '../../tools/access-state';
import { ACCESS_PANEL, accessPanelHref, readAccessPanel, type AccessPanel } from '../../tools/access-panel';
import type { SeatRegion } from '../../tools/seats';
import type { AccessActionResult } from '../../actions/action-results';

/**
 * S-16's screen state, in one place its regions read from (26 Aug 2026, project owner's review of
 * the first cut).
 *
 * The first version was one component that owned everything and passed it down: `RoleCell` took
 * `rows`, `busy` and an `onChange` that was itself a two-argument function; `RowActions` took five
 * props, two of them callbacks built inline inside a column definition. Every one of those existed
 * only because a cell is five levels below the state it needs — a `DataTable` renders its own rows,
 * so there is no way to hand a cell anything except through the column, and the column is built by
 * the component that holds the state. That is a context-shaped problem: the consumers are not the
 * children of the owner in any useful sense, they are *reached* by a library in between.
 *
 * **The state itself is a reducer, in `tools/access-state.ts`** — pure, and tested there. This file is
 * the wiring: it turns a reducer plus a router into the three behaviours a region calls, and
 * publishes both through one context.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** The section provides
 * it, and `board/`, `invite/` and — since task 50.3 — `remind/` read it: the board's notice, filters,
 * list, cells and confirmation, the invite dialogue and its form, the reminder panel and its form. So it
 * sits where all of them can see it, one level above the regions.
 *
 * **What this is not.** It holds no server state — the rows arrive already read, filtered, sorted
 * and paged by the Server Component, and nothing here caches or refetches them. It is the screen's
 * own interaction state: which action is running, what the last one said, what is being confirmed.
 * That is precisely the residue `apps/web/CLAUDE.md` says belongs in React context, and precisely
 * not the "cache server state twice" reach it warns against.
 *
 * **TanStack Query was considered here and does not fit** (26 Aug 2026). It is pinned for the three
 * polls and autosave's queued mutations, and `apps/web/CLAUDE.md` scopes it to *client islands* —
 * "never a parallel data path around the session proxy". Both of its halves would be that here. Its
 * cache would hold a second copy of rows the Server Component already renders, keyed client-side,
 * which is the same duplication that rules out a global store; and its `useMutation` would wrap a
 * Server Action whose pending, error and success this file already reads from the action's own
 * outcome, adding a dependency to re-express `useTransition`. What Query *would* have bought is
 * per-mutation pending state, which the first cut genuinely lacked — and that is delivered by the
 * reducer's `pendingRowKey`, without a second data path. Query earns its place when a screen polls
 * or drains a queue; this one does neither.
 *
 * **`useCallback` and `useMemo` are load-bearing here, not decoration.** A context value rebuilt
 * every render re-renders every consumer, and the consumers are two per row. `reactCompiler` is off
 * with a recorded reason, so nothing does this automatically. `dispatch` is stable by construction,
 * which is a second reason the reducer suits this file: two of the three behaviours below now have
 * empty dependency lists rather than lists that must be kept honest.
 */
interface AccessContextValue extends AccessState {
  readonly page: AccessPage;
  readonly view: AccessView;
  /**
   * The seat region (task 142), computed once by the section so the counter beside the heading and
   * the invite dialogue's arm read one value. Server state like `page`, and held here for `page`'s
   * reason — the dialogue is reached through the provider, not handed props by the section.
   */
  readonly seats: SeatRegion;
  /** True while a navigation this screen started is in flight. */
  readonly navigating: boolean;
  readonly setView: (next: Partial<AccessView>) => void;
  readonly perform: (input: {
    readonly row: AccessRow;
    readonly action: () => Promise<AccessActionResult>;
    readonly success: string;
  }) => void;
  readonly ask: (confirmation: Confirmation) => void;
  readonly dismiss: () => void;
  /**
   * An action left for the server from a region that owns no row — the invite form, and the reminder form
   * since task 50.3.
   *
   * Separate from `perform` because that panel runs its own transition and owns its own copy;
   * what it needs from here is only that the screen holds **one** notice, so its submission
   * clears whatever the list was showing and vice versa.
   */
  readonly starting: () => void;
  /** Report a settled outcome, in the region that ran it. */
  readonly report: (notice: PlacedNotice) => void;
  /**
   * Open and close the invite dialogue by its address (28 Sep 2026; `access-panel.ts`). The filter row's
   * button, the list's first-use state and the reminder panel's *invite a colleague* all open it; its
   * close control and a sent invitation close it. Each pushes an entry, as the console's dialogues do,
   * so Back undoes the last of them.
   */
  readonly openInvite: () => void;
  readonly closeInvite: () => void;
}

const AccessContext = createContext<AccessContextValue | null>(null);

/**
 * The screen's state, from anywhere inside it.
 *
 * Throws rather than returning `null` outside the provider: a cell rendered without it would
 * otherwise fail as an undefined property access somewhere further down, in a component that has
 * nothing to do with the mistake.
 */
export function useAccess(): AccessContextValue {
  const value = use(AccessContext);
  if (value === null) {
    throw new Error('useAccess must be used inside <AccessProvider>');
  }
  return value;
}

export function AccessProvider({
  page,
  view,
  seats,
  children,
}: {
  readonly page: AccessPage;
  readonly view: AccessView;
  readonly seats: SeatRegion;
  readonly children: ReactNode;
}) {
  const t = useTranslations(ACCESS_MESSAGES);
  const tCommon = useTranslations('identity');
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [, startAction] = useTransition();
  const inviting = readAccessPanel(useSearchParams()) === ACCESS_PANEL.INVITE;
  const [state, dispatch] = useReducer(accessReducer, inviting, (open) => ({
    ...INITIAL_ACCESS_STATE,
    inviting: open,
  }));

  // **The address moved, so the state follows it — during render, not in an effect.** This is React's
  // "adjusting state when a prop changes": the dispatch re-runs this render before anything commits, so
  // no frame shows the dialogue open over a refusal an earlier attempt left. Comparing against the
  // state's own copy is what makes Back and Forward events too — a dispatch from the button alone
  // would miss them (`AccessState.inviting`).
  if (state.inviting !== inviting) {
    dispatch({ type: inviting ? ACCESS_EVENT.INVITE_OPENED : ACCESS_EVENT.INVITE_CLOSED });
  }

  const setView = useCallback(
    (next: Partial<AccessView>) => {
      // Any change to the filter or the sort resets the page: staying on page 3 of a list that just
      // became one page long shows nothing and reads as "no matches", which is a different screen.
      const resetsPage = next.page === undefined;
      const query = accessViewQuery({ ...view, ...next, ...(resetsPage ? { page: 1 } : {}) });
      startNavigation(() => {
        router.push(withQuery(ROUTES.ORGANIZATION_USERS, query));
      });
    },
    [router, view],
  );

  const perform = useCallback<AccessContextValue['perform']>(
    ({ row, action, success }) => {
      dispatch({ type: ACCESS_EVENT.ACTION_STARTED, rowKey: accessRowKey(row) });
      startAction(async () => {
        const outcome = await action();
        dispatch({
          type: ACCESS_EVENT.ACTION_SETTLED,
          // The outcome-to-notice rule is `@/lib/notice`'s, not this screen's — S-28 had grown a
          // second copy of it, and the two had already drifted. What stays here is what only this
          // screen can decide: the copy, and whether a refusal owns a "what now" of its own. It
          // does — "or reload the page" is a step the API's `detail` cannot know about, which is
          // the narrow case the slot exists for.
          notice: {
            region: NOTICE_REGION.LIST,
            ...noticeFromOutcome({
              outcome,
              success: { title: success, body: t('notice.body') },
              unreachable: {
                title: tCommon('unreachable.title'),
                body: tCommon('unreachable.body'),
              },
              successAction: t('notice.action'),
              failureAction: t('notice.failedAction'),
            }),
          },
        });
      });
    },
    [t, tCommon],
  );

  // `dispatch` is stable across renders by React's own guarantee, so these two need no dependencies
  // — where the setter versions had to list one each and would silently go stale if that list ever
  // fell behind the body.
  const ask = useCallback(
    (confirmation: Confirmation) =>
      dispatch({ type: ACCESS_EVENT.CONFIRMATION_REQUESTED, confirmation }),
    [],
  );
  const dismiss = useCallback(() => dispatch({ type: ACCESS_EVENT.CONFIRMATION_DISMISSED }), []);
  const starting = useCallback(
    () => dispatch({ type: ACCESS_EVENT.ACTION_STARTED, rowKey: null }),
    [],
  );
  const report = useCallback(
    (notice: PlacedNotice) => dispatch({ type: ACCESS_EVENT.ACTION_SETTLED, notice }),
    [],
  );
  // The address as it is at the press, read off `window` rather than off `useSearchParams()`: it is
  // the same value, and reading it here keeps both callbacks stable across every change of view.
  const openInvite = useCallback(() => showPanel(ACCESS_PANEL.INVITE), []);
  const closeInvite = useCallback(() => showPanel(null), []);

  const value = useMemo<AccessContextValue>(
    () => ({
      ...state,
      page,
      view,
      seats,
      navigating,
      setView,
      perform,
      ask,
      dismiss,
      starting,
      report,
      openInvite,
      closeInvite,
    }),
    [
      state,
      page,
      view,
      seats,
      navigating,
      setView,
      perform,
      ask,
      dismiss,
      starting,
      report,
      openInvite,
      closeInvite,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/**
 * A shallow move to the address with the dialogue opened or closed: Next's router follows
 * `history.pushState` and `useSearchParams` with it, and the server is not asked — nothing it reads
 * changed (`access-panel.ts`).
 */
function showPanel(panel: AccessPanel | null): void {
  const { pathname, search } = window.location;
  const next = accessPanelHref({ pathname, search, panel });
  // A sent invitation closes the dialogue, and the reader may have closed it while the send was in
  // flight — a second entry for the same address would make Back do nothing once.
  if (next === `${pathname}${search}`) return;
  window.history.pushState(null, '', next);
}

/** Whether this row's own controls should be inert — see `AccessState.pendingRowKey`. */
export function useRowBusy(row: AccessRow): boolean {
  const { pendingRowKey } = useAccess();
  return pendingRowKey === accessRowKey(row);
}
