/**
 * The operator's sidebar choice at `wide`, as this browser keeps it — the console remembers whether the sidebar was
 * left folded to its icon strip (project owner, 25 Oct 2026). A per-viewer convenience and nothing more: storage can
 * come back empty or refuse, and the sidebar is then full, the console's resting state at `wide`.
 */
export const SIDEBAR_PREFERENCE_KEY = 'easyesg.console.sidebar';

export const SIDEBAR_STATE = {
  EXPANDED: 'expanded',
  COLLAPSED: 'collapsed',
} as const;

export type SidebarState = (typeof SIDEBAR_STATE)[keyof typeof SIDEBAR_STATE];

/** Folded only when the stored value says so: nothing, or a value from an older console, reads as full. */
export const isCollapsed = (stored: string | null): boolean => stored === SIDEBAR_STATE.COLLAPSED;

export const toStored = (collapsed: boolean): SidebarState =>
  collapsed ? SIDEBAR_STATE.COLLAPSED : SIDEBAR_STATE.EXPANDED;
