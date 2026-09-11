import { WizardStep } from '@/features/wizard/components/section/wizard-step';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-07 — Report wizard, module step · RC · Wizard archetype
 *
 * **The shell is rendered by the step, not by the layout**, and that is a Next.js fact rather than a
 * preference: a layout at `[reportId]` cannot see the `[module]` segment, so a rail rendered there
 * could not mark which step is current — and `aria-current="step"` is the whole of how a
 * screen-reader user knows where they are in an ordered progression (NFR-75).
 *
 * **The fields are §6.2's anatomy bound to autosave (task 35.2)**, replacing task 35.1's list: a
 * control per kind, committing on blur with no save button (UX-34), the save-state indicator in the
 * shell's fixed location (UX-35), the unsynced banner (UX-37), and the exit control's warning when
 * something is unsent. The draft-integrity pattern is what discharges UC-35 here (UX-7, OQ-5).
 *
 * **The provider wraps the shell, not the fields.** The indicator is in the header, the banner
 * above the fields, the exit control beside the indicator — four regions of one state, and a
 * provider around any one of them would invite the rest to keep state of their own.
 *
 * States (§8.1) present: ready · error — permission · error — recoverable · **read-only**, naming
 * which of UX-13's causes applies and what restores editing · **offline / queued** · **pending —
 * async** (the indicator's *saving*) · success. Still to arrive: empty — first use and the two
 * loading states, with task 36's content; partial, with S-08 (task 42).
 *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders
 * `WizardStep`, which reads, decides the arm and draws the shell over the fields. **It has no
 * `loading.tsx`, and cannot**: a stale deep link to a module the pinned taxonomy does not carry is
 * answered with `notFound()` from the section, and a route-level boundary would flush a 200 before
 * the section knows — `wizard.spec.ts` asserts the 404 and caught exactly that when one was added.
 * The states list above still names `loading — initial` as to arrive; it arrives as a boundary
 * *inside* the shell, below the point where the module is known, not as a route file.
 */
type Props = { params: Promise<{ locale: string; reportId: string; module: string }> };

export const generateMetadata = localizedPageTitle(WIZARD_MESSAGES);

export default async function ReportModuleStepPage({ params }: Props) {
  const { reportId, module } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <WizardStep reportId={reportId} module={module} />;
}
