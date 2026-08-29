import type { ReactNode } from 'react';
import styles from './global-bar.module.css';

/**
 * Global bar — §11.5's Navigation entry, and §4.2's **first** tier (task 30.1).
 *
 * Three tiers exist and there is no fourth: this band, which is present on every authenticated
 * screen; `WorkspaceNav`, which is present outside the wizard; and the wizard's module rail, which
 * replaces the second rather than nesting inside it (UX-5).
 *
 * **UX-2 is what this component is for.** The active organization must be visible at all times and
 * must never be inferred from a URL segment or a request header — it is a property of the session.
 * That is why the name arrives as a plain string resolved server-side rather than as anything this
 * component could look up, and why no route below the authenticated shell carries an organization
 * id: a second source would turn an org-switch race or a revoked membership into a cross-tenant
 * render above AD-2's RLS boundary, where none of its probes would see it.
 *
 * **The organization region is a plate, not a control, until task 83.** The artboard draws a
 * trigger with a caret because it opens the switcher, and the switcher writes
 * `identity.session.active_organization_id` — a session write with no route until
 * `PUT /api/v1/session/organization` lands. Drawing the caret now would offer a control that
 * cannot act, which is the defect the tier's own link set avoids by omitting destinations that do
 * not render. When the write exists, this region becomes the trigger and the caret returns.
 *
 * **It holds slots, not knowledge.** This package owns no text and no router (the standing rule),
 * so the brand anchor and the account corner arrive as the caller's own elements; what is here is
 * the band, the regions and their contrast pairing.
 *
 * States (§8.1, the applicable subset — the others have no instance on a chrome band):
 *
 *  - **Empty — first use**: `organization` absent, which is what a verified account belonging to
 *    nothing sees on S-04. The artboard draws exactly this: brand and account corner, no plate.
 *  - **Partial / error — recoverable**: the same rendering, reached differently — the membership
 *    read failed, or the caller holds several memberships and has chosen none. The chrome never
 *    fails the screen it frames, and it never guesses a name; S-35 owns the sign-in-time failure
 *    and states it in words.
 *  - **Loading**: none by construction. The caller is a Server Component and the band arrives with
 *    the document, so there is nothing to skeleton and nothing to shift.
 */
export interface GlobalBarOrganization {
  /** Localized accessible label for the region — "Active organization", or its translation. */
  readonly label: string;
  /** The organization this request is acting for, as `GET /memberships` reports it. */
  readonly name: string;
}

export interface GlobalBarProps {
  /** Accessible name for the banner landmark, localized by the caller. */
  readonly label: string;
  /** The caller's own anchor to the workspace home, wrapping `BrandMark`. */
  readonly brand: ReactNode;
  /** Absent when no organization is resolved — see the state list above. */
  readonly organization?: GlobalBarOrganization;
  /** The account corner: the user menu today, the notification centre when S-26 exists. */
  readonly actions: ReactNode;
}

export function GlobalBar({ label, brand, organization, actions }: GlobalBarProps) {
  return (
    <header className={styles.bar} aria-label={label}>
      <div className={styles.identity}>
        {brand}
        {organization ? (
          <>
            {/* Decorative: the plate beside it is already a separate region with its own name. */}
            <span aria-hidden="true" className={styles.divider} />
            {/* The label is read, not seen. A screen-reader user reaching a bare company name in
                the banner has no way to know it is the scope everything below is filtered by,
                which is the entire content of UX-2. */}
            <p className={styles.organization}>
              <span className={styles.organizationLabel}>{organization.label}</span>
              <span className={styles.organizationName}>{organization.name}</span>
            </p>
          </>
        ) : null}
      </div>
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
