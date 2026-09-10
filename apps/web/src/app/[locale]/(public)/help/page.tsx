import { FocusColumn } from '@easyesg/ui';
import { NotYetAvailable } from '@/shared/address-notice';

/**
 * Help centre · signed in and guest
 *
 * UX-109 (Consistent Help, WCAG 2.2 3.2.6): help sits in the same place on every screen.
 *
 * Reference: `design/screens/EasyESG Help Centre.dc.html`.
 *
 * Not built — but the address answers. It renders §8.1's `error — not yet available` state
 * (task 103) in place of the blank page it used to return; `design_spec.md` §4.5 records why
 * that state is a pattern rather than an `S-nn` row. `design_spec.md` §5 owns this screen's
 * content, controls and states; `design/IMPLEMENTATION_PLAN.md` owns when it lands.
 * Prototypes in `design/screens/` are the rendered reference — read them for values, never
 * copy their markup (OQ-10).
 */
export default function HelpCentrePage() {
  return (
    <FocusColumn>
      <NotYetAvailable />
    </FocusColumn>
  );
}
