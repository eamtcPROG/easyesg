import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-26 — Notification centre · CA · UC-165…167 · Index
 *
 * FR-161: an unread count available from any screen, each item persisting until read or
 * dismissed rather than only while the user is present. Polling, not push — a push transport
 * exists nowhere in §5.4 or §10.4 and adding one is an amendment, not an implementation detail.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function NotificationCentrePage() {
  return <NotYetAvailable />;
}
