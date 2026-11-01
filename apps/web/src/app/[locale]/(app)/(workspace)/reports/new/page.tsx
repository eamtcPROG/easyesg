import { NewReportSection } from '@/features/reports/components/new-report-section';
import { REPORT_CREATION_MESSAGES } from '@/features/reports/components/reports-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * Report creation · OA, RC · UC-18 · Focus-shaped (task 32.3)
 *
 * **No `S-nn`, and that is `design_spec.md` OQ-21** — raised by this task rather than settled in
 * this comment, which is where the first draft left it. §4.4 goes S-06 (Index) → S-07 (Wizard) with
 * no record screen between them, and the creation artboard in `EasyESG Reporting Core.dc.html` is
 * labelled `S-05` where its own heading says *"creating a report"* — a prototype label, not an
 * inventory entry. It is built as S-06's exit because that is where §4.6 requires the Index's empty
 * state to lead; the register row carries what is assumed meanwhile and what changes if it is wrong.
 *
 * **Both choices are links, not state.** The entity and the period ride the address, so a half-made
 * choice is something the reader can reload, share or come back to (UX-4) — and the whole screen is
 * a Server Component except the confirm. That is also what lets the period list depend on the
 * entity: `GET /periods` is scoped to one entity by design (FR-21), so the second decision cannot
 * be offered until the first is made.
 *
 * **The pins are the deliverable, not decoration.** Task 32.3 exists because *DR-4 is only checkable
 * by a user if the pin is on the screen*: the versions shown here are the chosen period's, they are
 * what the report will copy at creation (FR-66), and nothing on this screen can change them.
 *
 * **Three of the artboard's decisions, and only two are ours.** The standard is one option shown
 * rather than hidden, as it draws it. Carry-forward — *"what to bring over from VSME 2024"* — is
 * per-field in the wizard (§6.6, UX-32) and has no field on `POST /reports`; refused rather than
 * drawn inert. **Scope is not asked, and FR-177 says it should be** — its acceptance criteria read
 * *"the scope flag is settable at creation"*, so this is a recorded **deferral** and not the
 * requirement being satisfied: `architecture.md` §12.5.6's task-32.3 row carries what is assumed
 * meanwhile, what changes if it is wrong, and the fact that no task row owns the creation-surface
 * control. What FR-177 does grant is adding Comprehensive later, which is what the screen tells the
 * reader.
 *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and hands the
 * address on unawaited — `NewReportSection` parses it, reads, and chooses the arm. It held the read
 * and a body component until then.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(REPORT_CREATION_MESSAGES);

export default async function NewReportPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <NewReportSection searchParams={searchParams} />;
}
