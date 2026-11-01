/**
 * **Where a dialogue hands focus back to: the control that raised it** (task 207; UX-113) — the element that held focus
 * as the dialogue opened, **unless that is an item in a menu**: the item closes with its menu, so on close there would be
 * nothing to return to. A menu is named by the button that opens it (`aria-labelledby`, which Radix sets on every
 * menu's content), so an item's origin is that button — the console's row ⋯, the account menu, the organization
 * switcher. Measured on the console's roster: the item still held focus as the question it raised mounted, and the
 * menu, counting focus moving into the dialogue as an interaction outside it, never handed focus back on its own.
 *
 * `null` where nothing meaningful held focus — `body`, as when a dialogue opens on its own — and the dialogue then
 * returns focus nowhere, as Radix would have.
 */
export function dialogueOrigin(focused: Element | null): HTMLElement | null {
  if (!(focused instanceof HTMLElement) || focused === focused.ownerDocument.body) return null;
  const menu = focused.closest('[role="menu"][aria-labelledby]');
  const button = menu === null ? null : focused.ownerDocument.getElementById(menu.getAttribute('aria-labelledby') ?? '');
  return button instanceof HTMLElement ? button : focused;
}
