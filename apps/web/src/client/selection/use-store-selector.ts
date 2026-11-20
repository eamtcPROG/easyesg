'use client';

import { useRef, useSyncExternalStore } from 'react';
import type { StateStore } from './state-store';

/** Two selections are the same answer — `Object.is` unless the reader says otherwise. */
export type SelectionEquality<S> = (previous: S, next: S) => boolean;

const UNREAD: unique symbol = Symbol('unread');

/**
 * One reader's slice of a `StateStore` (task 244): it re-renders when `select` answers something `isEqual` calls
 * different, and on no other publish.
 *
 * **The previous selection is answered again while it is equal to the next**, because `useSyncExternalStore` compares
 * snapshots with `Object.is`: a selector answering a fresh array each time would re-render on every publish, and would
 * read as a value that never settles. So a selector answers a primitive or an object the store already holds, or the
 * reader passes `isEqual` — a field's findings, an array, are the case.
 */
export function useStoreSelector<T, S>(
  store: StateStore<T>,
  select: (state: T) => S,
  isEqual: SelectionEquality<S> = Object.is,
): S {
  const kept = useRef<S | typeof UNREAD>(UNREAD);
  const snapshot = (): S => {
    const next = select(store.get());
    const previous = kept.current;
    if (previous !== UNREAD && isEqual(previous, next)) return previous;
    kept.current = next;
    return next;
  };
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
