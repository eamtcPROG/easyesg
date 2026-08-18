/**
 * The wizard's persistence model, where three requirements collide (AD-9).
 *
 * FR-37 autosave on blur or step change, with no save button. FR-38 queue locally and retry
 * while offline. NFR-38 p95 <= 250 ms, never blocking input. NFR-56 no acknowledged change is
 * ever lost — acknowledge only after a durable write.
 *
 * The design: field-level optimistic update in a client store, a debounced batched `PATCH` per
 * field group, an **IndexedDB-backed outbound queue that survives a tab close**, a per-field
 * `synced | queued | failed` indicator, and a persistent banner while anything is unsynced.
 *
 * Two things that look like details and are not:
 *
 * - **The server acknowledges only post-commit.** That is the entire content of NFR-56, and it
 *   is verified by kill-during-write fault injection across this path. An optimistic
 *   acknowledgement would pass every ordinary test and lose data exactly once, in production.
 * - **Conflict resolution is last-write-wins per field**, with the audit trail (FR-54) as the
 *   reconciliation record. Appropriate because the realistic concurrency is one or two people
 *   in one SME, not simultaneous editing.
 *
 * Validation state arrives in the same response as the write (FR-40, §11.1) — it is not a
 * second round trip and not a push. Computing it asynchronously would need an SSE or WebSocket
 * transport, which exists nowhere in the container view, the Compose services or the edge
 * configuration.
 *
 * Not built.
 */
export {};
