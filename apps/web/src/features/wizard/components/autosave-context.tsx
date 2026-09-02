'use client';

import type { SaveState } from '@easyesg/ui';
import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { browserPendingWriteStore, pendingWriteScope, useAutosave } from '@/client/autosave';
import { hasUnsynced, saveStateOf, unsyncedCount, type AutosaveState } from '../autosave-state';

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
  /** Whether the queue survives this tab — false in a browser that refused site data. */
  readonly durable: boolean;
}

const AutosaveContext = createContext<AutosaveContextValue | null>(null);

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
  const { state, change, retry, durable } = useAutosave({ reportId, scope, store });

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
      durable,
    }),
    [state, change, retry, durable],
  );

  return <AutosaveContext.Provider value={value}>{children}</AutosaveContext.Provider>;
}

export function useAutosaveContext(): AutosaveContextValue {
  const value = use(AutosaveContext);
  if (value === null) {
    throw new Error('useAutosaveContext must be used within AutosaveProvider (S-07).');
  }
  return value;
}
