import { readActiveMembership } from '@/server/memberships';
import { readOrganizationPeriods } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { toOverviewRows } from '../../../tools/overview';
import { AttentionRegion } from '../regions/attention-region';
import { EverythingRegion } from '../regions/everything-region';
import { OverviewEmpty } from '../states/overview-empty';
import { OverviewUnavailable } from '../states/overview-unavailable';
import { ResumeRegion } from '../regions/resume-region';

/**
 * UX-6's three questions, in UX-6's order — UC-67 and FR-23 (task 32.4).
 *
 * **The section reads; the regions derive** (task 125, reshaped twice by the project owner's
 * review before it shipped). This file does the three things no region can: resolve which of §8.1's arms the screen is
 * in, turn the wire's periods into rows, and ask the time. Every region then receives what was
 * *read* — the whole row set, the whole membership — and derives what it needs from it:
 * `attentionRows`, `resumableRow`, `everythingRows` and FR-25's `mayWrite` each live with the
 * question they answer. Adding a region is a line here; changing what one of them means is one file.
 *
 * **Four folders under `overview/`, and this is the only file that reaches three of them** (task
 * 126). `section/` is what S-05's route renders — this and the fallback it is paired with;
 * `regions/` is UX-6's three questions and the row two of them draw; `states/` is §8.1's arms that
 * *replace* the regions; `shared/` is the two files more than one of those reads. The loading state
 * sits here rather than with the other §8.1 arms because it is not an arm this function returns —
 * it is the boundary's fallback, and `page.tsx` is what hands it over, which is the same seam
 * `heading/` and `memberships/` each hold as a pair of two.
 *
 * **`canWrite` was a prop in the first draft and `membership` replaced it**, which is the same
 * move and the better one: a boolean is a lossy projection of the object, so a region that later
 * needs the role it holds or the organization it names would have had to be re-threaded from here.
 * Three call sites of `mayWrite` are three uses of **one** predicate, not three spellings of a rule
 * — the drift task 32.4 recorded was two *different* expressions of it, `membership?.role !== VIEWER
 * && membership !== null` on one screen against the opposite conjunct order on another, which is
 * exactly what having a shared predicate prevents.
 *
 * **The clock is the one thing that could not move with them, and it is why they take `rows` rather
 * than the read.** Two regions ask whether a deadline has passed; a region that parsed the read
 * itself would own a `new Date()` of its own, and one could call a filing overdue while another did
 * not, on a request that happens to straddle midnight in the period's zone. `toOverviewRows` is
 * where the clock enters and it is called exactly once, here. The selectors below it are pure
 * functions over rows that are already dated, which is what made moving them safe.
 *
 * **This is the screen's one boundary that *streams*, and the qualifier is the correction.** It read
 * *"the screen's one Suspense boundary"* until task 125's fourth pass gave the heading and the
 * membership list one each, and outlived the fact by a commit — the hazard of a docblock that states
 * a count of something outside its own file. Three regions have boundaries; only this one makes an
 * HTTP call (`GET /periods`) nothing else on the page makes, so only this one's fallback reaches the
 * shell — one pending boundary in the flushed shell, which is what `e2e/web/home.spec.ts` counts.
 * That is `async-suspense-boundaries` applied
 * where its own "when NOT to use" list does not bite: below the fold, not layout-defining, and a
 * genuinely slow read.
 *
 * **No `DataTable`, and that is not an omission.** It exists for the Index archetype — sortable,
 * filterable, paginated — and takes `cell` render functions, which a Server Component cannot hand
 * across the RSC boundary at all; using it would make the most-visited screen in the product a
 * client boundary to buy sorting UX-6 does not ask for, since each region has one order and it is
 * the question's own.
 *
 * States (§8.1) it routes between: ready · read-only (a view-only membership drops the actions,
 * FR-25) · empty — first use · error — permission · error — recoverable. The sixth, `loading`, is
 * the boundary's and lives in `overview-loading.tsx`.
 */
export async function OverviewSection() {
  // Independent, so they do not queue (`async-parallel`). The membership read is free — it is the
  // same memoized promise the heading and the global tier are already awaiting — so what this
  // boundary is actually waiting on is `GET /periods` alone. No translator: this file resolves no
  // strings at all, which is the clearest sign the split landed where it should.
  const [read, membership] = await Promise.all([
    readOrganizationPeriods(),
    readActiveMembership(),
  ]);

  if (read.status !== TENANT_READ.READY) {
    return <OverviewUnavailable reason={read.status} />;
  }

  // **The one clock.** `toOverviewRows` is where the time enters, and it is called exactly once so
  // no two regions can disagree about whether a deadline has passed on a request that straddles
  // midnight in the period's zone. Everything the regions call below it is a pure selector over rows
  // that are already dated, which is what made moving those selectors into them safe.
  const rows = toOverviewRows({ periods: read.periods, now: new Date() });

  if (rows.length === 0) {
    return <OverviewEmpty membership={membership} />;
  }

  // Three questions, one row set, no conditional: the resume region answers with nothing when there
  // is nothing to resume, which is UX-6's rule held where the rule's own region can see it.
  return (
    <>
      <AttentionRegion rows={rows} membership={membership} />
      <ResumeRegion rows={rows} />
      <EverythingRegion rows={rows} membership={membership} />
    </>
  );
}
