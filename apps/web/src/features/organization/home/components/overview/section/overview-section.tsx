import type { Invitation } from '@easyesg/contracts';
import { readOutstandingInvitations } from '@/server/data/invitations';
import { mayAdminister, readActiveMembership } from '@/server/data/memberships';
import { readOverviewRows } from '@/server/data/overview';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { AttentionRegion } from '../attention/attention-region';
import { EverythingRegion } from '../everything/everything-region';
import { ResumeRegion } from '../resume/resume-region';
import { OverviewEmpty } from '../states/overview-empty';
import { OverviewUnavailable } from '../states/overview-unavailable';

/** What a member who does not administer is shown about invitations: nothing, and never a failed read. */
const NO_INVITATIONS: readonly Invitation[] = [];

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
 * **A folder per question under `overview/` since task 255, and this is the only file that reaches all of
 * them.** `section/` is what S-05's route renders — this and the fallback it is paired with; `attention/`, `resume/`
 * and `everything/` are UX-6's three questions, each with the parts the artboard draws for it, which outgrew the one
 * `regions/` folder task 126 gave them; `states/` is §8.1's arms that *replace* the regions; `shared/` is the files
 * more than one of those reads. The loading state
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
 * than the read.** Since task 255 it lives one level further out, in `server/data/overview.ts`'s `cache()`d read,
 * because the rail's deadline card asks the same rows — so the time still enters once per request, now for both. Two regions ask whether a deadline has passed; a region that parsed the read
 * itself would own a `new Date()` of its own, and one could call a filing overdue while another did
 * not, on a request that happens to straddle midnight in the period's zone. `toOverviewRows` is
 * where the clock enters and it is called exactly once, here. The selectors below it are pure
 * functions over rows that are already dated, which is what made moving them safe.
 *
 * **It streams, because it waits on a read nothing above it has made** — `GET /periods`, through
 * `readOverviewRows` — so its fallback reaches the shell. Which of the screen's boundaries stream is a fact about the
 * composition, so it is `e2e/web/home.spec.ts`'s to measure and not this docblock's to count: the count it held until
 * task 125 outlived the fact by a commit. That is `async-suspense-boundaries` applied where its own "when NOT to use"
 * list does not bite: not layout-defining, and a genuinely slow read.
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
  // boundary is actually waiting on is `GET /periods`, and for an administrator `GET /invitations` beside it. No
  // translator: this file resolves no strings at all, which is the clearest sign the split landed where it should.
  //
  // **The invitations are an administrator's alone** (task 255): the api refuses anyone else, so the read is not made
  // for them rather than made and refused. The membership is the same memoized promise the global tier awaited, so
  // chaining the invitations behind it adds no round trip — the three still run together.
  const membershipRead = readActiveMembership();
  const [read, membership, invitations] = await Promise.all([
    readOverviewRows(),
    membershipRead,
    membershipRead.then((active) => (mayAdminister(active) ? readOutstandingInvitations() : NO_INVITATIONS)),
  ]);

  if (read.status !== TENANT_READ.READY) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    if (read.status === TENANT_READ.FORBIDDEN) await redirectToChoiceIfOwed();
    return <OverviewUnavailable reason={read.status} />;
  }

  // The rows arrive dated: `readOverviewRows` is where the time enters, once per request, so no two regions — nor
  // the rail's card beside them — can disagree about whether a deadline has passed.
  const { rows, now } = read;

  if (rows.length === 0) {
    return <OverviewEmpty membership={membership} />;
  }

  // Three questions, one row set, no conditional: the resume region answers with nothing when there
  // is nothing to resume, which is UX-6's rule held where the rule's own region can see it.
  return (
    <>
      <AttentionRegion rows={rows} invitations={invitations} now={now} membership={membership} />
      <ResumeRegion rows={rows} membership={membership} />
      <EverythingRegion rows={rows} membership={membership} />
    </>
  );
}
