/**
 * Polling — the named mechanism for every asynchronous result in this application.
 *
 * **Polling is the authority, and it is the floor.** §11.1 rejected a push transport and named the
 * procedure for adding one — "a deliberate change to §5.4 and §10.4, not an implementation
 * detail" — and **AD-15 is that change, taken 12 Sep 2026**: a gateway fans out contentless hints
 * that make an accelerated surface refetch SOONER. It never replaces a poll. A frame carries
 * `{event, organizationId, since}` and nothing renderable, every event names the HTTP path that is
 * its authority, and a dropped frame costs latency rather than correctness. So this file keeps its
 * name: what polls here is what the product's correctness rests on, whether or not a socket is up.
 *
 * The gateway is tenant-side only (tasks 147–149) and does not serve `apps/admin` — AD-15 scopes it
 * out, and NFR-65's network restriction is not a surface to reopen for a latency gain.
 *
 * Three things poll:
 *
 * - **Order state after a payment hand-off.** §11.2: the browser return and the acquirer
 *   callback are separate events and the return very often arrives FIRST. Order state is
 *   authoritative from the callback only; the return URL triggers a poll and nothing else.
 *   Drawing "provisioned" as a synchronous consequence of the return is the most common
 *   checkout bug on hosted-payment-page rails.
 * - **Export job state.** `POST /reports/{id}/exports` answers 202 with a job id (AD-10).
 *   Past 30 s the result is delivered by notification instead (NFR-42).
 * - **The notification unread count**, available from any screen (FR-161).
 *
 * UX-116: under April–May filing-window load, no element may depend on a poll more frequent
 * than the state it reflects actually changes.
 *
 * Not built. **Intervals are set** — architecture.md OQ-36, closed 12 Sep 2026: order state 3 s
 * within its bounded window, export job state 5 s, the unread count 60 s, S-16's access list 30 s,
 * every poll stopped while the tab is hidden, and failure backoff full-jitter exponential to a
 * five-minute cap. NFR-110 makes the disconnected interval the guaranteed ceiling, so none of
 * these may be lengthened on the grounds that the accelerator covers them.
 */
export {};
