import type { ReactNode } from 'react';
import { WizardProviders } from '@/features/wizard/components/wizard-providers';

/**
 * The wizard shell - S-07 and everything reached from inside a report.
 *
 * UX-5: "The wizard shall suppress the workspace tier and replace it with the module list, so
 * that the user's only navigational choice inside a report is *which module*. Exit from the
 * wizard shall be a single, always-visible, explicitly labelled control that states that work
 * is saved."
 *
 * **The shell itself is rendered by the step, not here** (task 35.1): a layout at this segment
 * cannot see `[module]`, so a rail rendered here could not mark the current step. What this layout
 * owns since task 35.2 is the wizard's client-island providers — TanStack Query's client, for the
 * autosave transport — which are the same for every step and survive a step change, where the
 * step's own state does not.
 *
 * The save-state indicator is not decoration. UX-35: four states - saved, saving, queued (no
 * connection), failed - in ONE fixed location, text-labelled rather than icon-only, and
 * announced to assistive technology on transition (UX-112, polite live region, on transition
 * only so typing does not produce announcement noise). It moves to *saving* only once the
 * NFR-38 budget of p95 <= 250 ms is exceeded, and never shows a false *saved*: the
 * acknowledgement follows the durable commit, which is the whole content of NFR-56.
 */
export default function WizardLayout({ children }: { children: ReactNode }) {
  return <WizardProviders>{children}</WizardProviders>;
}
