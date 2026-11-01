/**
 * A-05 — Validation rule definitions · PA · UC-82 · Editor
 *
 * Validation rule definitions and their messages, maintained separately from the thresholds they test (FR-73).
 *
 * One interpreter, two execution sites (§9.8): packages/validation re-validates authoritatively in
 * apps/api and shows findings inline in apps/web. A rule edited here changes both. Messages are
 * keys — no rule may carry a literal sentence, and no finding may name an enum member.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/rules/validation')({
  component: ValidationRulesRoute,
});

function ValidationRulesRoute() {
  return null;
}
