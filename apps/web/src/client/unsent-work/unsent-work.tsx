'use client';

import { createContext, use, useEffect, useState, type ReactNode } from 'react';

/**
 * Unsent work, told to whatever is about to leave it behind (task 83.2; UX-3, UX-37).
 *
 * **Why a registry at the `(app)` layout.** The one producer is the wizard's autosave, mounted inside a
 * report's step; the reader of it is the organization switch, mounted in the global tier above every
 * screen. The two are in different branches of the tree, so neither can hand the other a prop, and
 * `AutosaveProvider` cannot move up without carrying a report into screens that have none. So the step
 * *reports* what it holds here and the switch *reads* it; with nothing reported, nothing is unsent.
 *
 * **What is reported is a standing, not the queue.** How many changes wait, whether sending them is stuck
 * — offline, or refused — rather than merely on its way, and a way to try again now. The queue itself
 * stays the wizard's. Task 93's sign-out, UX-37's third trigger, is the next reader this shape expects.
 *
 * **Two contexts, so a reporter does not re-render on what it reports**: the setter is stable, and only
 * the readers subscribe to the value.
 */
export interface UnsentWork {
  /** Changes queued and not yet acknowledged. */
  readonly unsynced: number;
  /** Whether sending them is stuck — offline, or the last attempt failed — rather than on its way. */
  readonly blocked: boolean;
  /** Another attempt, now. */
  readonly retry: () => void;
}

const NOTHING_UNSENT: UnsentWork = { unsynced: 0, blocked: false, retry: () => undefined };

const UnsentWorkValue = createContext<UnsentWork>(NOTHING_UNSENT);
const UnsentWorkReport = createContext<((work: UnsentWork | null) => void) | null>(null);

export function UnsentWorkProvider({ children }: { readonly children: ReactNode }) {
  const [work, setWork] = useState<UnsentWork | null>(null);
  return (
    <UnsentWorkReport.Provider value={setWork}>
      <UnsentWorkValue.Provider value={work ?? NOTHING_UNSENT}>{children}</UnsentWorkValue.Provider>
    </UnsentWorkReport.Provider>
  );
}

/** What is unsent right now, anywhere under the `(app)` layout. */
export const useUnsentWork = (): UnsentWork => use(UnsentWorkValue);

/**
 * Report what this screen holds, for as long as it is mounted. `work` should be memoized over its
 * primitives: a new object per render is a new report per render. Outside a provider it reports nowhere.
 */
export function useReportUnsentWork(work: UnsentWork): void {
  const report = use(UnsentWorkReport);
  useEffect(() => {
    report?.(work);
  }, [report, work]);
  // Its own effect, so a change in what is reported replaces the report without first withdrawing it — an
  // order of calls this file guarantees, not a difference a reader of the registry is shown.
  useEffect(() => () => report?.(null), [report]);
}
