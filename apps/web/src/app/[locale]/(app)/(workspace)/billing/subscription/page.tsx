import { NotYetAvailable } from '@/shared/not-yet-available';

/**
 * S-24 — Subscription status and history · OA · UC-99…107 · Status + Index
 *
 * UX-53: before any entitlement reduction, the affected entities and reports are listed BY NAME
 * and it is stated explicitly that nothing is deleted (D-13, NFR-80).
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function SubscriptionStatusPage() {
  return <NotYetAvailable />;
}
