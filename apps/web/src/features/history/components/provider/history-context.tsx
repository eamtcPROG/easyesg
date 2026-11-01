'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { HistoryRequest } from '../../tools/history-request';
import { HistoryPanel } from '../panel/history-panel';

interface HistoryContextValue {
  readonly open: (request: HistoryRequest) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

/**
 * S-12 for one screen (task 84.2; UC-47; `architecture.md` §12.5.6's task-84 row) — what opens the panel, and the panel.
 *
 * **Mounted only for a member who may read the trail** — an editor or the Organization Administrator (182/22), decided
 * on the server where the membership is. A trigger asks `useHistory()` and draws nothing where it answers `null`, so a
 * view-only member is offered no way into a read the api would refuse, with no role held in the browser.
 *
 * **One value, the request**: opening another field's history while the panel is open moves it to that field, and
 * closing it clears it. Nothing else moves with it, so a `useState` (the reducer rule's own exemption).
 */
export function HistoryProvider({
  organizationId,
  readerAccountId,
  children,
}: {
  /** The organization the screen was rendered for — what keys the reads (`use-change-history.ts`). */
  readonly organizationId: string;
  /** The reader, whom an entry they made names as themself. */
  readonly readerAccountId: string;
  readonly children: ReactNode;
}) {
  const [request, setRequest] = useState<HistoryRequest | null>(null);
  const open = useCallback((next: HistoryRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo<HistoryContextValue>(() => ({ open }), [open]);

  return (
    <HistoryContext.Provider value={value}>
      {children}
      <HistoryPanel request={request} onClose={close} organizationId={organizationId} readerAccountId={readerAccountId} />
    </HistoryContext.Provider>
  );
}

/** The way into S-12 on this screen, or `null` where the reader may not read the trail. */
export function useHistory(): HistoryContextValue | null {
  return use(HistoryContext);
}
