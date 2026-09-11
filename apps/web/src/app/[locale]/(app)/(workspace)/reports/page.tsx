import { ReportsSection } from '@/features/reports/components/reports-section';
import { REPORTS_MESSAGES } from '@/features/reports/components/reports-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-06 — Reports index · RC, OA · UC-17 · Index (task 32.2.2)
 *
 * Which reports are open to this member, and where each one stands (FR-25).
 *
 * **Three of the artboard's six columns belong to other tasks and are refused rather than
 * invented**, which is the parent row's own decision with its owners recorded: completion is task
 * 41.3's roll-up, validation findings are task 40's, and the export count beneath a filed row is
 * task 47's. The *Last activity* column ships half-built on purpose — the instant without the
 * actor, because `GET /reports` answers no actor and provenance (§6.13, FR-55) reaches a screen
 * only when a read answers it.
 *
 * **This screen was blocked until S-07 became real** (task 32.2.2's row): §4.4 has no report record
 * screen, so an Index row's only exit is the wizard, and pointing the busiest list in the product
 * at a redirector returning nothing is the dead row action task 30.1 ruled against. Tasks 35.1 …
 * 36.2 built that exit; `reports/[reportId]/page.tsx` now resolves to a step and redirects.
 *
 * **It DOES read the caller's role, and that is where this screen differs from S-13 and S-15.**
 * Those two carry no read-only state a producer exists for — S-13's is entitlement-reduced entities,
 * task 54's. S-06's is *view-only membership*, which FR-25 states as an acceptance criterion —
 * *"a view-only member sees the same entries and no edit affordances"* — and §5's own States row
 * lists as `read-only (view-only membership)`. The role is already in hand and `cache()`d, so the
 * first draft's *"the screen never computes the caller's role"* was a rule carried from screens
 * where it holds to the one screen where the requirement says otherwise.
 *
 * The entries are unchanged for a viewer; only the two writes disappear — which is the clause read
 * literally, and is why the read stays open to every member (§12.5.6's task-32.2.1 row makes the
 * same point from the API's side).
 *
 * States (§8.1): ready · read-only (view-only membership) · empty — first use · empty — filtered ·
 * error — permission · error — recoverable. The two empty states are `ReportsList`'s, because §4.6
 * requires them to teach and teaching means naming this object. *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section, which reads, decides the arm and draws. `loading.tsx` beside it is the screen's
 * `loading — initial`, on S-16's precedent — the whole body waits on the read, so there is no
 * shell worth streaming ahead of it.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(REPORTS_MESSAGES);

export default async function ReportsIndexPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <ReportsSection searchParams={searchParams} />;
}
