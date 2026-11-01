import { SiteFooter } from './site-footer';
import styles from './workspace-footer.module.css';

/**
 * The signed-in footer — `SiteFooter`'s note and legal links in the frame the workspace artboards draw under every
 * screen (`EasyESG Workspace.dc.html`, `EasyESG Organization Admin.dc.html`): a band on the default surface, a rule
 * above, the note at one end and the links at the other, pushed to the foot of a short page.
 *
 * **In `src/shared/` because four readers draw it** — `(workspace)` and `(account)` beneath their screens, and since
 * 19 Oct 2026 the wizard's two sections, S-07's step and S-09, through `WizardShell`'s `footer` slot, beneath the step
 * and beside the module list (project owner; `design_spec.md` §4.2's amendment of that date — the wizard's artboards
 * draw none, and the report's pages now read as the others do). It owns the `<footer>` element and `SiteFooter` the
 * content, as `FocusShell` does for the identity screens — one `contentinfo` landmark per page.
 *
 * **Its legal links answer *not yet available* until task 75.3 builds S-30**, as they already do from every identity
 * screen; `(public)/layout.tsx`'s reason for holding its footer back — that they return `null` — predates task 103.
 */
export function WorkspaceFooter() {
  return (
    <footer className={styles.footer}>
      <SiteFooter />
    </footer>
  );
}
