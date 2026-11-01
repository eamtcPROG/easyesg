/**
 * The wizard's persistence model, where three requirements collide (AD-9) — built by task 35.2.
 *
 * FR-37 autosave on blur or step change, with no save button. FR-38 queue locally and retry
 * while offline. NFR-38 p95 <= 250 ms, never blocking input. NFR-56 no acknowledged change is
 * ever lost — acknowledge only after a durable write.
 *
 * What is here: `useAutosave`, the hook that wires `features/wizard/autosave-state.ts`'s reducer to
 * a transport, the network events, the durable queue and the unload guard; `PendingWriteStore`, the
 * IndexedDB-backed queue that survives a tab close, with a memory fallback; and
 * `putDisclosureValues`, the one browser write, through the token-attaching pass-through.
 *
 * Two things that look like details and are not:
 *
 * - **The server acknowledges only post-commit.** That is the entire content of NFR-56, and the
 *   reducer moves nothing out of `pending` until the response arrives. An optimistic
 *   acknowledgement would pass every ordinary test and lose data exactly once, in production.
 * - **Conflict resolution is last-write-wins per field**, with the audit trail (FR-54) as the
 *   reconciliation record. Appropriate because the realistic concurrency is one or two people
 *   in one SME, not simultaneous editing.
 *
 * Validation state is to arrive in the same response as the write (FR-40, §11.1) — it is not a
 * second round trip and not a push. The response carries the stored state today; the verdicts are
 * task 41's, and the reducer's `committed` overlay is where they will land.
 */
export {
  browserPendingWriteStore,
  indexedDbPendingWriteStore,
  memoryPendingWriteStore,
  pendingWriteScope,
  type PendingWriteStore,
  type PendingWriteStoreHandle,
} from './pending-store';
export { putDisclosureValues } from './write-values';
export { useAutosave, type AutosaveHandle } from './use-autosave';
