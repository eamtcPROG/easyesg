'use client';

import type { SaveState } from '@easyesg/ui';
import { createContext, use, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { browserPendingWriteStore, pendingWriteScope, useAutosave } from '@/client/autosave';
import { createStateStore, type StateStore } from '@/client/selection/state-store';
import { useStoreSelector, type SelectionEquality } from '@/client/selection/use-store-selector';
import { useReportUnsentWork, type UnsentWork } from '@/client/unsent-work/unsent-work';
import {
  flushIsBlocked,
  hasUnsynced,
  saveStateOf,
  unsyncedCount,
  type AutosaveState,
} from '../../tools/autosave-state';

/**
 * S-07's draft-integrity state, in one place every region of the step reads from (task 35.2).
 *
 * **A provider around the whole screen, not one region of it** (`apps/web/CLAUDE.md`, 29 Aug 2026):
 * the indicator lives in the shell's header, the banner above the fields, the fields in the body
 * and the exit control beside the indicator — four regions, five levels apart, all reading one
 * value. A provider around any one of them would invite the others to keep state of their own.
 *
 * **What this is not.** It holds no server state: the step arrives already read and joined by the
 * Server Component, and nothing here caches or refetches it. It is the screen's own interaction
 * state — what is unsent, what the API said — which is the residue the root `CLAUDE.md` says
 * belongs in React context.
 */
export interface AutosaveContextValue {
  readonly state: AutosaveState;
  readonly saveState: SaveState;
  readonly unsynced: number;
  readonly hasUnsynced: boolean;
  readonly change: ReturnType<typeof useAutosave>['change'];
  readonly retry: ReturnType<typeof useAutosave>['retry'];
  /** Lets a set-aside write go (task 218) — the banner's, per item. */
  readonly discard: ReturnType<typeof useAutosave>['discard'];
  /** The report the queue is this report's — what a set-aside item's link leads into (task 218). */
  readonly reportId: string;
  /** The session tier said the session has ended (task 92) — the rail's and the exit's probe. */
  readonly endSession: ReturnType<typeof useAutosave>['endSession'];
  /** The reader signed in again over the step (task 92) — the dialogue's. */
  readonly resume: ReturnType<typeof useAutosave>['resume'];
  /** Whether the queue survives this tab — false in a browser that refused site data. */
  readonly durable: boolean;
}

/**
 * What changes nothing when the queue moves — the acts and the report (task 244). **A reader that only writes reads
 * this**, so a commit elsewhere on the step does not re-render it: `useAutosave`'s acts are `dispatch` wrapped in
 * `useCallback` with no dependency, stable for the provider's life.
 */
export type AutosaveActions = Pick<
  AutosaveContextValue,
  'change' | 'retry' | 'discard' | 'reportId' | 'endSession' | 'resume' | 'durable'
>;

const AutosaveContext = createContext<AutosaveContextValue | null>(null);
const AutosaveActionsContext = createContext<AutosaveActions | null>(null);
const AutosaveStoreContext = createContext<StateStore<AutosaveState> | null>(null);

export function AutosaveProvider({
  reportId,
  accountId,
  children,
}: {
  readonly reportId: string;
  /** Scopes the durable queue to the session that filled it — see `pending-store.ts`. */
  readonly accountId: string;
  readonly children: ReactNode;
}) {
  // Created once per mount: the hook's effects key on the store's identity, and a store recreated
  // per render would reload the queue on every keystroke.
  const [store] = useState(browserPendingWriteStore);
  const scope = pendingWriteScope({ accountId, reportId });
  const { state, change, retry, discard, endSession, resume, durable } = useAutosave({ reportId, scope, store });

  // **The queue's state, published for the readers that select from it** (task 244) — a field reads its own entry
  // and re-renders when that moves, not on every transition a commit makes. Published after the
  // commit, so a selection never sees a state the provider has not rendered.
  const [published] = useState(() => createStateStore(state));
  useLayoutEffect(() => published.publish(state), [published, state]);
  const actions = useMemo<AutosaveActions>(
    () => ({ change, retry, discard, reportId, endSession, resume, durable }),
    [change, retry, discard, reportId, endSession, resume, durable],
  );

  // A non-primitive handed to a provider: memoized, or every consumer re-renders on every render
  // of this component regardless of whether the state moved (the rerender rule, by hand — no
  // compiler does it here).
  const value = useMemo<AutosaveContextValue>(
    () => ({
      state,
      saveState: saveStateOf(state),
      unsynced: unsyncedCount(state),
      hasUnsynced: hasUnsynced(state),
      change,
      retry,
      discard,
      reportId,
      endSession,
      resume,
      durable,
    }),
    [state, change, retry, discard, reportId, endSession, resume, durable],
  );

  // Task 83.2: the step's standing, told to the `(app)` layout's registry, so an organization switch in
  // the global tier sends these answers first or asks before leaving them (UX-3, UX-37). Memoized over
  // primitives, because the state object moves on changes the registry has no interest in.
  const unsynced = unsyncedCount(state);
  const blocked = flushIsBlocked(state);
  const unsentWork = useMemo<UnsentWork>(() => ({ unsynced, blocked, retry }), [unsynced, blocked, retry]);
  useReportUnsentWork(unsentWork);

  return (
    <AutosaveActionsContext.Provider value={actions}>
      <AutosaveStoreContext.Provider value={published}>
        <AutosaveContext.Provider value={value}>{children}</AutosaveContext.Provider>
      </AutosaveStoreContext.Provider>
    </AutosaveActionsContext.Provider>
  );
}

export function useAutosaveContext(): AutosaveContextValue {
  const value = use(AutosaveContext);
  if (value === null) {
    throw new Error('useAutosaveContext must be used within AutosaveProvider (S-07).');
  }
  return value;
}

/** The acts alone (task 244) — for a reader that writes and shows nothing of the queue. */
export function useAutosaveActions(): AutosaveActions {
  const value = use(AutosaveActionsContext);
  if (value === null) {
    throw new Error('useAutosaveActions must be used within AutosaveProvider (S-07).');
  }
  return value;
}

/**
 * One reader's slice of the queue's state (task 244) — a field's acknowledged value, its save state. It re-renders when
 * `select` answers something different and on no other transition; see `useStoreSelector` for what a selector may
 * answer.
 */
export function useAutosaveSelector<S>(select: (state: AutosaveState) => S, isEqual?: SelectionEquality<S>): S {
  const store = use(AutosaveStoreContext);
  if (store === null) {
    throw new Error('useAutosaveSelector must be used within AutosaveProvider (S-07).');
  }
  return useStoreSelector(store, select, isEqual);
}
