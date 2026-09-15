import type { ReactNode } from 'react';
import { GLOBAL_BAR_TONE, type GlobalBarTone } from './global-bar-vocabulary';
import styles from './global-bar.module.css';

/**
 * Global bar — §11.5's Navigation entry, and §4.2's **first** tier (task 30.1).
 *
 * Three tiers exist and there is no fourth: this band, which is present on every authenticated
 * screen; `WorkspaceNav`, which is present outside the wizard; and the wizard's module rail, which
 * replaces the second rather than nesting inside it (UX-5).
 *
 * **It is also the `(public)` chrome, since task 74.1** — §11.5's Navigation row enumerates one
 * band and this is it, so the sentence above describes §4.2's tiers rather than this component's
 * reach. `design_spec.md` §11.5's sixth bullet records the reading and names the two differences
 * that belong to the caller, not to the band: a public actions slot holds three nodes where the
 * account corner holds one, and the section nav arrives with task 74.3 — which is the point to
 * re-read that bullet rather than inherit it.
 *
 * **UX-2 is what this component is for.** The active organization must be visible and must never be
 * inferred from a URL segment or a request header — it is a property of the session. That is why the
 * organization arrives from the caller, resolved server-side, rather than as anything this component
 * could look up, and why no route below the authenticated shell carries an organization id: a second
 * source would turn an org-switch race or a revoked membership into a cross-tenant render above AD-2's
 * RLS boundary, where none of its probes would see it.
 *
 * **The organization region is a slot since task 83.2, and what fills it is the switcher.** Task 30.1
 * drew a plate with no caret, because the session write had no route and a control that cannot act is
 * worse than an absent one; 83.1 gave it the route, and the app now passes `OrganizationSwitcher` here.
 * **Below the medium frame the region is not drawn** — `design_spec.md` UX-2's amendment (project owner,
 * 15 Sep 2026) puts the organization and its control in the compact drawer instead.
 *
 * **And the administrative console's band, since task 67.1, through `tone`** — `design_spec.md`
 * §11.5's *Console nav* paragraph records the reading. The anatomy is this one: a brand slot, an
 * actions slot, a landmark. What differs is the surface — dark neutral where the tenant band is
 * brand-dark, a separate realm that says so (§5.2) — and the height, 46px from the console artboard
 * against 68px here, which still clears NFR-75's 40px target for the account corner. The console
 * passes no `organization`, and must never (D-5).
 *
 * **It holds slots, not knowledge.** This package owns no text and no router (the standing rule),
 * so the brand anchor, the organization's control and the account corner arrive as the caller's own
 * elements; what is here is the band, the regions and their contrast pairing.
 *
 * States (§8.1, the applicable subset — the others have no instance on a chrome band):
 *
 *  - **Empty — first use**: `organization` absent, which is what a verified account belonging to
 *    nothing sees on S-04. The artboard draws exactly this: brand and account corner, no plate.
 *  - **Partial / error — recoverable**: the same rendering, reached differently — the membership
 *    read failed, or the reader is on S-37 choosing among several. The chrome never fails the screen it
 *    frames, and it never guesses a name; S-35 owns the sign-in-time failure and states it in words.
 *  - **Loading**: none by construction. The caller is a Server Component and the band arrives with
 *    the document, so there is nothing to skeleton and nothing to shift.
 */
export interface GlobalBarProps {
  /** Accessible name for the banner landmark, localized by the caller. */
  readonly label: string;
  /** The caller's own anchor to the workspace home, wrapping `BrandMark`. */
  readonly brand: ReactNode;
  /** The active organization's control; absent when none is resolved — see the state list above. */
  readonly organization?: ReactNode;
  /** The account corner: the user menu today, the notification centre when S-26 exists. */
  readonly actions: ReactNode;
  /** The surface the band is drawn on. Absent is the tenant and public band. */
  readonly tone?: GlobalBarTone;
}

export function GlobalBar({
  label,
  brand,
  organization,
  actions,
  tone = GLOBAL_BAR_TONE.BRAND,
}: GlobalBarProps) {
  return (
    // The tone is an attribute rather than a second class, so the value a spec pins is the value
    // the stylesheet selects on.
    <header className={styles.bar} data-tone={tone} aria-label={label}>
      <div className={styles.identity}>
        {brand}
        {organization ? (
          <>
            {/* Decorative: the control beside it names itself. */}
            <span aria-hidden="true" className={styles.divider} />
            <div className={styles.organization}>{organization}</div>
          </>
        ) : null}
      </div>
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
