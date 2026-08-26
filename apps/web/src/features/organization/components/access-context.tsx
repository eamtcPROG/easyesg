'use client';

import { CALLOUT_INTENT, type CalloutIntent } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { ROUTES, withQuery } from '@/lib/routes';
import { useRouter } from '@/i18n/navigation';
import {
  accessRowKey,
  accessViewQuery,
  type AccessPage,
  type AccessRow,
  type AccessView,
} from '../access';
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
 * per-mutation pending state, which the first cut genuinely lacked — and that is delivered below by
 * `pendingRowKey`, without a second data path. Query earns its place when a screen polls or drains a
 * queue; this one does neither.
 *
 * **`useCallback` and `useMemo` are load-bearing here, not decoration.** A context value rebuilt
 * every render re-renders every consumer, and the consumers are two per row. `reactCompiler` is off
 * with a recorded reason, so nothing does this automatically; the value below is memoised on state
 * that actually changes, and each behaviour is stable across renders that did not change it.
 */

/** Which confirmation the dialogue is asking for. Both are consequence-disclosing (UX-70). */
export const CONFIRMATION = {
  /** UC-63 — withdraw a member's access. */
  REMOVE: 'remove',
  /** UC-61 — withdraw an outstanding invitation. */
  REVOKE: 'revoke',
} as const;

export type ConfirmationKind = (typeof CONFIRMATION)[keyof typeof CONFIRMATION];

export interface Confirmation {
  readonly kind: ConfirmationKind;
  readonly row: AccessRow;
}

/**
 * A completed action, reported beside the list.
 *
 * All three parts NFR-79 requires, `action` included — the slot is required by `Callout` for
 * exactly the reason this screen first got wrong: filled with a control's label ("Actions") it
 * reads as decoration, and the reader is left without the sentence saying what to do next. On a
 * success that sentence is honestly "nothing"; saying so is not the same as omitting it.
 */
export interface Notice {
  readonly intent: CalloutIntent;
  readonly title: string;
  readonly body: string;
  readonly action: string;
}

interface AccessContextValue {
  readonly page: AccessPage;
  readonly view: AccessView;
  /** The server's clock, so a row's standing is the one the server filtered on. */
  readonly now: number;
  /** Where the first-use empty state sends a reader. */
  readonly inviteAnchorId: string;
  readonly notice: Notice | null;
  readonly confirming: Confirmation | null;
  /** True while a navigation this screen started is in flight. */
  readonly navigating: boolean;
  /**
   * The row whose action is running, by row key — **not a screen-wide boolean.**
   *
   * The first cut disabled every control on every row while any one action ran, because
   * `useTransition`'s pending flag is per component and the component was the whole board. Pressing
   * *resend* on one invitation greyed out the other nine rows.
   */
  readonly pendingRowKey: string | null;
  readonly setView: (next: Partial<AccessView>) => void;
  readonly perform: (input: {
    readonly row: AccessRow;
    readonly action: () => Promise<AccessActionResult>;
    readonly success: string;
  }) => void;
  readonly ask: (confirmation: Confirmation) => void;
  readonly dismiss: () => void;
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
  const value = useContext(AccessContext);
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
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);

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
      const key = accessRowKey(row);
      setPendingRowKey(key);
      startAction(async () => {
        const outcome = await action();
        setPendingRowKey(null);
        setConfirming(null);
        setNotice(
          outcome.status === API_OUTCOME.Ok
            ? {
                intent: CALLOUT_INTENT.SUCCESS,
                title: success,
                body: t('notice.body'),
                action: t('notice.action'),
              }
            : {
                intent: CALLOUT_INTENT.ERROR,
                // The API's own three-part text, as received — the screen keeps no second copy of
                // "they already have access" or "an invitation is outstanding".
                title:
                  outcome.status === API_OUTCOME.Problem
                    ? (outcome.problem.title ?? tCommon('unreachable.title'))
                    : tCommon('unreachable.title'),
                body:
                  outcome.status === API_OUTCOME.Problem
                    ? (outcome.problem.detail ?? tCommon('unreachable.body'))
                    : tCommon('unreachable.body'),
                action: t('notice.failedAction'),
              },
        );
      });
    },
    [t, tCommon],
  );

  const ask = useCallback((confirmation: Confirmation) => setConfirming(confirmation), []);
  const dismiss = useCallback(() => setConfirming(null), []);

  const value = useMemo<AccessContextValue>(
    () => ({
      page,
      view,
      now,
      inviteAnchorId,
      notice,
      confirming,
      navigating,
      pendingRowKey,
      setView,
      perform,
      ask,
      dismiss,
    }),
    [
      page,
      view,
      now,
      inviteAnchorId,
      notice,
      confirming,
      navigating,
      pendingRowKey,
      setView,
      perform,
      ask,
      dismiss,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Whether this row's own controls should be inert — see `pendingRowKey`. */
export function useRowBusy(row: AccessRow): boolean {
  const { pendingRowKey } = useAccess();
  return pendingRowKey === accessRowKey(row);
}
