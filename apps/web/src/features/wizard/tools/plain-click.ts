/**
 * Whether a click on a link is the plain one a page may take over (task 92) — the primary button, no
 * modifier, not already handled.
 *
 * S-07's rail and exit hold a plain click while they ask whether the session is still held. Every other
 * click keeps what the browser does with it — a new tab, a new window, a download — because those leave
 * this page standing, and a session found gone there is met by the proxy in the tab that opens.
 *
 * Pure and in `tools/` because two wizard controls read it.
 */
export interface ClickLike {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
}

/** `MouseEvent.button`'s primary button. */
const PRIMARY_BUTTON = 0;

export const isPlainClick = (click: ClickLike): boolean =>
  !click.defaultPrevented &&
  click.button === PRIMARY_BUTTON &&
  !click.metaKey &&
  !click.ctrlKey &&
  !click.shiftKey &&
  !click.altKey;
