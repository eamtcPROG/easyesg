import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Focus layout — one task, no navigation (design_spec.md §4.6).
 *
 * Pathless: the group establishes a layout, not a URL segment, so A-01 lives at `/sign-in` rather
 * than `/focus/sign-in`. It is a sibling of `_realm`, not a parent, because the whole point of the
 * archetype is that the console chrome is absent — nesting it under the realm would make that
 * chrome a conditional render, which is how it ends up half-suppressed on the one screen that must
 * not show it.
 */
export const Route = createFileRoute('/_focus')({
  component: FocusLayout,
});

function FocusLayout() {
  return <Outlet />;
}
