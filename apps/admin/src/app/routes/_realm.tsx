import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Realm layout — the signed-in console chrome for every screen behind the administrative realm.
 *
 * Pathless, so it adds no URL segment. Everything below it requires an authenticated,
 * MFA-verified session on the separate admin realm (FR-75, NFR-65) — the guard itself is `realm/`
 * and lands in Phase 2, blocked on architecture.md OQ-33.
 *
 * Two properties are stated once here rather than repeated on all eighteen screens, per
 * `design_spec.md` §5.2's own preamble: compact density, and `wide`/`extra` viewports only.
 * UX-77 requires the console *state* the viewport limit rather than degrade below it — so the
 * narrow-viewport notice belongs in this layout, not in each screen.
 *
 * The absence of any tenant-scoped context here is deliberate and load-bearing. This console has
 * no active organization: D-5 gives a Platform Administrator no standing access to any
 * organization's report data, and the only path to it is A-07's time-boxed grant. An organization
 * selector in this chrome would be that standing access, arriving as a convenience.
 */
export const Route = createFileRoute('/_realm')({
  component: RealmLayout,
});

function RealmLayout() {
  return <Outlet />;
}
