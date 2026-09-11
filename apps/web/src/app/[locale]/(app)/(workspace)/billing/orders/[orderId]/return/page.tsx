import { NotYetAvailable } from '@/shared/not-yet-available';

/**
 * S-20 — Payment hand-off and return · OA · UC-116…121 · Focus + Status
 *
 * The browser return and the acquirer callback are separate events and the return very often
 * arrives FIRST. Order state is authoritative from the callback only; the return URL triggers a
 * poll and nothing else (§11.2). All four outcomes are designed — success, failure, cancellation
 * and abandonment mid-challenge. The indeterminate return shows *pending*, not an error (UX-58).
 *
 * No card field exists on this or any other screen: NFR-60 is verified by DOM review, and card
 * capture belongs to the acquirer's hosted page (D-7, PCI SAQ-A).
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function PaymentReturnPage() {
  return <NotYetAvailable />;
}
