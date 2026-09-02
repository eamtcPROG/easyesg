'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  use,
  useMemo,
  useReducer,
  useTransition,
} from 'react';
import type { ReactNode } from 'react';
import { noticeFromOutcome } from '@/lib/notice';
import { ROUTES, withQuery } from '@/lib/routes';
import { useRouter } from '@/i18n/navigation';
import {
  accessRowKey,
  accessViewQuery,
  type AccessPage,
  type AccessRow,
  type AccessView,
} from '../access';
import {
  ACCESS_EVENT,
  INITIAL_ACCESS_STATE,
  NOTICE_REGION,
  accessReducer,
  type AccessState,
  type Confirmation,
  type PlacedNotice,
} from '../access-state';
import type { AccessActionResult } from '../types/action-results';

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
 * **The state itself is a reducer, in `../access-state.ts`** — pure, and tested there. This file is
 * the wiring: it turns a reducer plus a router into the three behaviours a region calls, and
 * publishes both through one context.
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
  /** The server's clock, so a row's standing is the one the server filtered on. */
  readonly now: number;
  /** Where the first-use empty state sends a reader. */
  readonly inviteAnchorId: string;
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
   * An action left for the server from a region that owns no row — the invite form.
   *
   * Separate from `perform` because that panel runs its own transition and owns its own copy;
   * what it needs from here is only that the screen holds **one** notice, so its submission
   * clears whatever the list was showing and vice versa.
   */
  readonly starting: () => void;
  /** Report a settled outcome, in the region that ran it. */
  readonly report: (notice: PlacedNotice) => void;
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
  now,
  inviteAnchorId,
  children,
}: {
  readonly page: AccessPage;
  readonly view: AccessView;
  readonly now: number;
  readonly inviteAnchorId: string;
  readonly children: ReactNode;
}) {
  const t = useTranslations('organization.access');
  const tCommon = useTranslations('identity');
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [, startAction] = useTransition();
  const [state, dispatch] = useReducer(accessReducer, INITIAL_ACCESS_STATE);

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

  const value = useMemo<AccessContextValue>(
    () => ({
      ...state,
      page,
      view,
      now,
      inviteAnchorId,
      navigating,
      setView,
      perform,
      ask,
      dismiss,
      starting,
      report,
    }),
    [
      state,
      page,
      view,
      now,
      inviteAnchorId,
      navigating,
      setView,
      perform,
      ask,
      dismiss,
      starting,
      report,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Whether this row's own controls should be inert — see `AccessState.pendingRowKey`. */
export function useRowBusy(row: AccessRow): boolean {
  const { pendingRowKey } = useAccess();
  return pendingRowKey === accessRowKey(row);
}
