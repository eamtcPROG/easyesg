# Answer key — do not put this in a review agent's context

What each fixture hunk must be reported as. An agent that misses one has stopped applying that rule.

## convention.md

| Hunk | Must be reported as | Rule it violates |
| --- | --- | --- |
| 1 | `transfer(periodId, reportingEntityId, actorId)` takes three positional parameters, and the first two are both `string` and adjacent — swapped, it compiles and moves the wrong period. Take one named object. | root `CLAUDE.md`, *"An application-boundary call takes one object, never positional parameters"*, and its extension to *"any function whose adjacent parameters share a type"* |
| 2 | One event writes three different setters, so the handler never says what the state it did not write should be. One `useReducer`, or a single discriminated value. | root `CLAUDE.md`, *"Values that change together are one `useReducer`, not several `useState`s"* — the tell is *"two **different** setters called in one handler"* |
| 3 | A component defined inside a screen file. It has no state set, no dark map, no expansion coverage and no accessibility review, and the next screen that needs it copies all four omissions. | UX-89 via root `CLAUDE.md`, *"No screen shall introduce a one-off component"* — add it to `packages/ui` or use the inventory |

**Trap in hunk 3**, and an agent that falls for it is over-reporting: the *styling* is not the
finding. Tailwind classes in a screen are not what UX-89 forbids; the one-off **component** is. A
good agent puts it under "not rules" and says it cannot quote a rule against it.

### Hunk 1 carries a SECOND finding, and it is required

**Promoted from "additional" to required on 31 Aug 2026, by the model measurement** — it is the one
finding that separated Opus from Sonnet, so a key that treats it as a bonus cannot discriminate at
all. An agent that reports only the positional parameters has **half** of hunk 1.

- **`actorId` is a *parameter*, so the caller names the actor.** `PeriodService` already resolves it from the request context and says why
  — *"an attribution the caller could name is not an attribution"* (FR-22, FR-55). Rank it above the
  positional-parameter finding.
- **Hunk 2 also reimplements `noticeFromOutcome`** (`apps/web/CLAUDE.md`: the outcome-to-notice
  translation lives in `src/lib/notice.ts`, extracted after three screens grew their own copy and
  two drifted), and uses a **manual pending flag with no `try/finally`**, so a rejected submit
  strands the form disabled with no message — `useTransition` per `vercel-react-best-practices`.
- **Hunk 3's component is named in the inventory**: §11.5's domain table carries *"Version pin
  indicator"*, so this is not even a judgement call about what *"nothing fits"* means.

Missing a seeded finding is a failure. Missing the `actorId` finding is a failure. The other two are
the agent working.

### Model measurement — 31 Aug 2026, convention fixture

| | seeded 3 | trap declined | unplanted 3 | tokens | duration |
| --- | --- | --- | --- | --- | --- |
| **Opus** | 3/3 | yes | 3/3 | 194k | 264 s |
| **Sonnet** | 3/3 | yes | **0/3** | **355k** | 231 s |

Two things worth keeping.

**The fixture as first written could not tell them apart.** Sonnet passed every stated criterion —
found all three seeded defects, quoted them accurately, declined the trap, and even declined a
fourth candidate with a reason rather than guessing. On the bar as written it is the equal of Opus.
The difference was entirely in what neither of them was *asked* to find, which is why the `actorId`
finding is now required rather than a bonus. **A fixture only measures what it demands.**

**The cheaper tier was not cheaper in tokens.** Sonnet spent 1.8× Opus's, because it read the
compiled skill documents cover to cover where Opus read them index-then-targeted and *said so in its
report*. Per-token price still favours Sonnet; the gap is much smaller than the tier suggests, and
this is worth re-checking rather than assuming.

Re-measure against this strengthened key before moving any pin.

## spec.md

| Hunk | Must be reported as | Why |
| --- | --- | --- |
| 1 | The comment misstates FR-22. Its criterion was **amended** (30 Aug 2026) to say the lock refuses every write *"nor can an Organization Administrator"* — so the code implements the reading the amendment exists to overturn. | `functional_requirements.md` FR-22 as amended; `architecture.md` §12.5.6's task-31.2 row |
| 2 | A retention period invented at a call site. No document sets 90 days, and NFR-29 governs what survives an erasure request — an unknown closed in passing, with no register row and no §12.5.6 entry. | root `CLAUDE.md`, *"Open questions are not debt"* — *"do not invent an answer, do not pick a sensible default, and do not leave a TODO"* |
| 3 | Two failures at once: reasoning in `task.md`'s **Status column**, which holds one of four words and nothing else; and a decision (`jsonb` over a column per type) recorded in a tracking file that **owns no decisions** instead of in `architecture.md` §12.5.6. | root `CLAUDE.md`'s Status rule and the document-set precedence |

An agent that reports hunk 3 as only a formatting problem has missed the more expensive half — the
decision has no home.

### Additional findings a good agent will make (verification run, 31 Aug 2026)

- **Hunk 1 also reverses a closed decision, not just a citation.** §12.5.6's task-31.2 row *declines
  the literal role reading in terms*, and `mayEditWhileLocked` re-implements it. A strong agent also
  notices the second-writer problem: §12.5.6's task-31.3 row makes the period lock the **only**
  writer of the report's `open`/`locked`.
- **Hunk 2's number contradicts a schedule that already exists.** `architecture.md` §12.5.7 and
  OQ-20 (*Closed — schedule set*) give report content **organization life + 1 year**; 90 days is the
  **application logs** row. So this is not only an invented threshold, it is the wrong row of a
  closed table — and no FR or UC authorises purging a report at all, while FR-45's comparatives
  depend on the prior period surviving.
- **Hunk 3's `jsonb` contradicts §7.3's shipped DDL**, which specifies `value_numeric`, `value_text`,
  `value_boolean`, `value_date` — a column per *datatype*, four of them, which do not grow per
  taxonomy release. The stated rationale borrows AD-3's argument against *column per disclosure* for
  a question AD-3 did not ask, and AD-3's other rejected alternative — *whole report as a JSONB
  blob* — is the one adjacent to it.

### One thing this fixture surfaced about the repository, not the fixture

`docs/task.md`'s rows 34 and 34.1 call it **"the `jsonb` value table"** while `architecture.md` §7.3
specifies four typed columns and no `jsonb` column. Verified independently. Whoever builds 34.1 has
to reconcile them, and by precedence the document wins and the task row is what is wrong. Left for
the project owner: it is a specification question, not a cleanup.

## gate-integrity.md

| Hunk | Must be reported as | The breakage it would miss |
| --- | --- | --- |
| 1 | The list is declared in the direction that cannot catch omission. It names what the application **may** insert, so a column added later with no grant appears in neither the actual set nor the declaration and `toEqual` passes — while the application cannot write it. Declare what is **withheld**. | a column added by a later task shipping unwritable; surfaces in production as `42501`, never at a gate |
| 2 | Two workarounds, both findings rather than locator style: `.first()` resolves a duplicate button by ignoring it, and `count() > 0` cannot distinguish one alert from two. Assert an exact count. | a button rendered twice, or two simultaneous alerts — permanently invisible, because the suite can no longer fail on either |
| 3 | The test's name says *refuses* and its assertion says `200`. It passes whether the refusal works or not. | the guard being removed entirely |

Hunk 3 is the cheapest to miss and the most damaging: the suite reports a passing test named for a
rule nothing enforces.

### Additional findings a good agent will make (verification run, 31 Aug 2026)

- **Hunk 1 guards `INSERT` where the guarantee rests on `UPDATE`.** The mechanism at `core.report` is
  `GRANT UPDATE (scope, status, updated_at)` and nothing else; `INSERT` stays table-wide *on
  purpose*, because withheld columns are set at creation. So the one breakage it exists to catch — a
  pin regaining `UPDATE` — is invisible to it. It also registers the table in a map
  `appImmutableColumns` does not read, leaving the withheld direction unguarded, and it has no
  `provingViolation` twin where every neighbouring invariant has one.
- **Hunk 2's subject cannot occur.** `REPORT_STATUS.FILED` is declared and unwritten until task 47,
  and `aFiling` produces an *open* report in an unlocked period — so deleting the word "filed" from
  the title would not change what runs. Nothing in production refuses it either: both the use case
  and the trigger key on `locked` alone.
- **Hunk 3's file is collected by no runner**, which a strong agent proves rather than asserts:
  `e2e/playwright.config.ts` sets `testDir: '.'` relative to `e2e/`, so a spec at
  `apps/web/e2e/web/…` is outside it, outside vitest's `src/**` include and outside the api's jest
  pattern. It also notes `count()` does not retry where `expect(locator)` polls, and that
  `role="alert"` has three producers in `packages/ui`.
