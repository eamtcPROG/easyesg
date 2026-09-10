import { NotYetAvailable } from '@/shared/address-notice';

/**
 * S-27 — Profile, language, notification preferences · CA · UC-13, UC-14, UC-168 · Record
 *
 * Interface language is set here and persists across devices and sessions (FR-10). It is
 * independent of export language (S-11, FR-52) and of email language, which resolves per
 * recipient (FR-169). Transactional categories cannot be switched off (UC-168).
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function ProfilePreferencesPage() {
  return <NotYetAvailable />;
}
