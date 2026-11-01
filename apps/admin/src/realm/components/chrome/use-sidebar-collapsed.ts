import { useCallback, useState } from 'react';
import { SIDEBAR_PREFERENCE_KEY, isCollapsed, toStored } from '../../tools/sidebar-preference';

/**
 * Whether the operator left the sidebar folded, kept in this browser (25 Oct 2026). Read once, when the chrome mounts,
 * and written on every change; a browser that refuses its storage — a private window, blocked site data — keeps the
 * choice for this page and starts the next one full.
 */
const readStored = (): string | null => {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
  } catch {
    return null;
  }
};

const writeStored = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, toStored(collapsed));
  } catch {
    // Refused: the choice lasts this page, which is all a convenience owes.
  }
};

export function useSidebarCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => isCollapsed(readStored()));
  const change = useCallback((next: boolean) => {
    setCollapsed(next);
    writeStored(next);
  }, []);
  return [collapsed, change];
}
