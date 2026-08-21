/**
 * The clock, behind a port (P-7).
 *
 * **Why time is injected at all**, since a `new Date()` inside a use case looks harmless: almost
 * every rule this platform enforces is a window, and a window is only testable if the test can
 * choose "now". OQ-52's 7-day unverified account, OQ-35's 7-day idle and 30-day absolute session,
 * §12.5.6's 60-minute reset link and 15-minute throttle — each of them is otherwise verifiable
 * only by waiting. `session-expiry.spec.ts` asserts the absolute cap wins over the idle window by
 * handing the use case a date 30 days on; with an ambient clock that spec cannot exist.
 *
 * It lives in `contracts/` rather than `types/` because it is a **dependency**, not a
 * representation: `types/time.ts` owns how an instant is spelled (`EpochMillis`, `LegalDate`),
 * and this owns where one comes from. The token sits beside the type for the reason every other
 * port does — a consumer imports one thing (CLAUDE.md, P-7).
 *
 * **One clock per injection point, deliberately not one global clock.** `FakeAccountStore` holds
 * a `databaseClock` distinct from the clock its use case reads, because OQ-52's window is
 * measured from when the row was *written* and the decision instant is a different fact. A single
 * ambient `now` would erase a distinction that has already mattered.
 */
export type Clock = () => Date;

export const CLOCK = Symbol('CLOCK');
