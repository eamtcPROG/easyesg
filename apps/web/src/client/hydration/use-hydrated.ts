'use client';

import { useSyncExternalStore } from 'react';

const neverChanges = () => () => {};

/**
 * Whether this render is the browser's, after hydration (task 153; §12.5.6's task-153 row) — `false` in the server's
 * HTML and during hydration itself, `true` from the first render after, and never back.
 *
 * **`useSyncExternalStore` rather than an effect that sets state**: the server snapshot is what hydration renders,
 * so the two agree and React raises no mismatch, and the store never changes, so nothing re-renders for it. A credential
 * form reads it to keep its submit disabled until its handler exists — which is what makes Enter before hydration
 * submit nothing.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
