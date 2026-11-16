/**
 * A value many components read and few need all of (task 244): held outside React, published after each commit, and
 * read through `useStoreSelector` so a reader re-renders only when **its** slice moves.
 *
 * **Why not a context alone.** A context re-renders every reader whenever its value changes, whatever part of it the
 * reader destructures, and `useMemo` around the value only helps while the value is unchanged. S-07's autosave state
 * moves on every transition of a commit — changed, sent, acknowledged — so every field of a step re-rendered for an
 * answer in one of them (the measurement is task 244's build-log entry). A store with per-reader selection is the
 * shape React gives this case (`useSyncExternalStore`), and nothing else here holds state: the reducer that owns it is
 * still the provider's.
 */
export interface StateStore<T> {
  readonly get: () => T;
  readonly subscribe: (listener: () => void) => () => void;
  /** Publishes the next value, notifying readers only when it is a different object. */
  readonly publish: (next: T) => void;
}

export function createStateStore<T>(initial: T): StateStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (next) => {
      if (Object.is(next, current)) return;
      current = next;
      for (const listener of listeners) listener();
    },
  };
}
