import { BrandMark, FocusShell } from '@easyesg/ui';
import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Focus layout — one task, no navigation (design_spec.md §4.6), on the same `FocusShell`
 * archetype the tenant identity screens use (UX-89 — the inventory, not a copy), carrying the
 * A-01 artboard's realm statement in the shell's own slots: the mono `ADMIN` chip beside the
 * brand, and the host the operator is actually on at the right — "a separate realm, and it
 * says so", before any credential is typed. The host is `location.host`, data rather than a
 * message key: stating a configured name a proxy could contradict would be the lie the chip
 * exists to prevent. The artboard's full-dark ground (vs the shell's dark-header light-ground)
 * is a recorded divergence for design review — a per-screen skin variant is UX-127's smell,
 * not an inventory addition.
 *
 * Pathless: the group establishes a layout, not a URL segment, so A-01 lives at `/sign-in`.
 * It is a sibling of `_realm`, not a parent, because the whole point of the archetype is that
 * the console chrome is absent. No footer, deliberately: the console has no language switcher
 * (OQ-42) and its legal surface is the tenant site's.
 */
export const Route = createFileRoute('/_focus')({
  component: FocusLayout,
});

/** "ADMIN" is the realm's proper name on this chip, like the wordmark: identity, not copy,
 *  and no catalogue owns it (BrandMark's own precedent for the untranslated wordmark). */
const REALM_CHIP = 'ADMIN';

function FocusLayout() {
  return (
    <FocusShell
      brand={
        <span className="flex items-center gap-[var(--space-3)]">
          <BrandMark />
          <span className="t-code rounded-[2px] border border-[var(--pine-400)] px-[6px] py-[2px] text-[9.5px] uppercase tracking-[0.16em] text-[var(--focus-header-text-muted)]">
            {REALM_CHIP}
          </span>
        </span>
      }
      actions={
        <span className="t-code text-[10.5px] text-[var(--focus-header-text-muted)]">
          {window.location.host}
        </span>
      }
    >
      <Outlet />
    </FocusShell>
  );
}
