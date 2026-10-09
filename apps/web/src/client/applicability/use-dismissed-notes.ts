'use client';

import type { DisclosureField } from '@easyesg/contracts';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { forgetNotAsked } from '@/features/wizard/tools/applicability-notes';
import { readDismissed, subscribeDismissed, writeDismissed, type NoteScope } from './dismissed-notes';

/**
 * The step's dismissed applicability notes, read from this browser and kept in step with what the step asks (task 95;
 * UX-27).
 *
 * **`null` in the server's HTML and during hydration** — `useSyncExternalStore`'s server snapshot, as `useHydrated`'s
 * is — so the caller draws no note before it knows which were closed, and a dismissed note never flashes.
 *
 * **A field read as not asked is forgotten in render, not by an effect that clears state** (`forgetNotAsked`): what is
 * shown is derived from the stored set and the fields together, and the one effect carries the forgetting back to the
 * store — an external system, which is what an effect is for — so a note returns with its field on a later visit too.
 */
export function useDismissedNotes(input: {
  readonly scope: NoteScope;
  readonly fields: readonly DisclosureField[];
}): { readonly dismissed: ReadonlySet<string> | null; readonly dismiss: (elementKeys: readonly string[]) => void } {
  const { accountId, reportId } = input.scope;
  const stored = useSyncExternalStore(
    subscribeDismissed,
    () => readDismissed({ accountId, reportId }),
    () => null,
  );

  // Filtering the set against the step's fields, re-run on every autosave transition otherwise — `apps/web/CLAUDE.md`'s
  // second manual-memoization case, with `reactCompiler` off. `forgetNotAsked` answers `stored` itself where nothing is
  // forgotten, which is what lets the effect below tell the two apart.
  const dismissed = useMemo(
    () => (stored === null ? null : forgetNotAsked({ dismissed: stored, fields: input.fields })),
    [stored, input.fields],
  );

  useEffect(() => {
    if (dismissed !== null && dismissed !== stored) writeDismissed({ scope: { accountId, reportId }, dismissed });
  }, [stored, dismissed, accountId, reportId]);

  const dismiss = (elementKeys: readonly string[]) =>
    writeDismissed({ scope: { accountId, reportId }, dismissed: new Set([...(dismissed ?? []), ...elementKeys]) });

  return { dismissed, dismiss };
}
