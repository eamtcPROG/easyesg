/**
 * Which of S-07's applicability notes this reader has dismissed (task 95; UX-27; `architecture.md` §12.5.6's task-95
 * row) — the elements whose note they closed, per account and per report, in this tab's `sessionStorage`.
 *
 * **The tab's session, never the browser's** (Stage 2's close, §12.5.6): a dismissal is a preference, and
 * `architecture.md` OQ-23 closed consent on the basis that no browser storage holds one — so a dismissal lasts while
 * the tab does, survives a reload, and the note returns in the next session. **Keyed by the account and the report, as
 * the autosave queue is** (`pending-store.ts`): a note one person closed is not closed for the next person to sign in
 * in the same tab, nor for another report of theirs. **A convenience, never a record** — nothing else reads it, no other
 * tab sees it, and a store the browser refuses (site data blocked, quota spent) throws on access, which here reads as
 * *nothing dismissed*: every note shows, which is where the step started. **The key carries its version**, so a later
 * shape of the value is a new key rather than a misread of this one.
 *
 * **Shaped as an external store for `useSyncExternalStore`**: a read answers the same set for the same stored string,
 * so React can compare snapshots by identity, and a write tells this page's readers — no other tab shares the store,
 * so no `storage` event can carry a write here.
 */
export interface NoteScope {
  readonly accountId: string;
  readonly reportId: string;
}

const keyOf = (scope: NoteScope): string => `easyesg.applicability-notes.v1.${scope.accountId}.${scope.reportId}`;

/** Nothing dismissed — one identity, so an empty or refused store is a stable snapshot. */
const NOTHING: ReadonlySet<string> = new Set();

/** The last set read per key, with the string it was read from. */
const lastRead = new Map<string, { readonly raw: string; readonly dismissed: ReadonlySet<string> }>();

const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: this page's writes, the only writes this tab's store receives. */
export function subscribeDismissed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The dismissed elements — the same set while the stored string is unchanged — or none where nothing will answer. */
export function readDismissed(scope: NoteScope): ReadonlySet<string> {
  const key = keyOf(scope);
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return NOTHING;
  }
  if (raw === null) return NOTHING;
  const last = lastRead.get(key);
  if (last?.raw === raw) return last.dismissed;
  const dismissed = parse(raw);
  lastRead.set(key, { raw, dismissed });
  return dismissed;
}

/** Read, never cast: a value another version of this page wrote, or a hand-edited one, is no dismissal. */
function parse(raw: string): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(raw);
    return Array.isArray(stored) ? new Set(stored.filter((key): key is string => typeof key === 'string')) : NOTHING;
  } catch {
    return NOTHING;
  }
}

/** Stores the set — an empty one removes the entry rather than keeping `[]` for every report ever opened. */
export function writeDismissed(input: { readonly scope: NoteScope; readonly dismissed: ReadonlySet<string> }): void {
  try {
    if (input.dismissed.size === 0) sessionStorage.removeItem(keyOf(input.scope));
    else sessionStorage.setItem(keyOf(input.scope), JSON.stringify([...input.dismissed]));
  } catch {
    // Refused storage: nothing is remembered, and every note shows again on the next read.
  }
  for (const listener of listeners) listener();
}
