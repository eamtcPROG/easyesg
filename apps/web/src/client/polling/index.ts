/**
 * Polling — the named mechanism for every asynchronous result in this application.
 *
 * There is no SSE and no WebSocket. §11.1 records the decision explicitly: a push transport
 * "exists nowhere in the container view, the Compose services or the `edge` configuration, and
 * … brings replica-affinity consequences with it." Adding one is a deliberate change to §5.4
 * and §10.4, not an implementation detail.
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
 * Not built. Intervals and backoff are unspecified in the doc set — logged in architecture.md §18.
 */
export {};
