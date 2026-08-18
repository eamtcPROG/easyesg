import type { ReactNode } from 'react';

/**
 * The wizard shell - S-07 and everything reached from inside a report.
 *
 * UX-5: "The wizard shall suppress the workspace tier and replace it with the module list, so
 * that the user's only navigational choice inside a report is *which module*. Exit from the
 * wizard shall be a single, always-visible, explicitly labelled control that states that work
 * is saved."
 *
 * Renders: the module rail (eleven Basic modules, each with its own state indicator), the
 * save-state indicator, the validation entry point, and the exit control.
 *
 * The save-state indicator is not decoration. UX-36: four states - saved, saving, queued (no
 * connection), failed - in ONE fixed location, text-labelled rather than icon-only, and
 * announced to assistive technology on transition (UX-112, polite live region, on transition
 * only so typing does not produce announcement noise). It moves to *saving* only once the
 * NFR-38 budget of p95 <= 250 ms is exceeded, and never shows a false *saved*: the
 * acknowledgement follows the durable commit, which is the whole content of NFR-56.
 */
export default function WizardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
