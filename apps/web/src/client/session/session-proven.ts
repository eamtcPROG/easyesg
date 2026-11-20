/**
 * When this tab last heard the session answer as held (task 244) — so S-07's step change can skip its probe.
 *
 * **The probe exists to open the re-authentication dialogue where a navigation would have met the sign-in screen**
 * (task 92, UX-38), and it costs a round trip before every step change. An answer from the session tier or an
 * acknowledged autosave flush within the window below has just proven the same thing, so asking again buys nothing a
 * reader could notice. What is given up is narrow and recorded (`architecture.md` §12.5.6's task-244 row (2)): a
 * session ended elsewhere in the last minute meets the sign-in screen with `?return=` on the next step change rather
 * than the dialogue, and the unsent queue, held in IndexedDB under the account, drains after sign-in as it always has.
 *
 * Module state, deliberately: it is one fact about this tab, written only from the browser — a flush's success and
 * the probe's answer — and read only in a click handler.
 */
export const SESSION_PROVEN_WINDOW_MS = 60_000;

let provenAt: number | null = null;

/** The session answered as held at `now` — a probe's `204`, a flush the api acknowledged. */
export function noteSessionProven(now: number = Date.now()): void {
  provenAt = now;
}

/** Whether the session was proven held within the window — the step change's reason to skip its probe. */
export function sessionRecentlyProven(now: number = Date.now()): boolean {
  return provenAt !== null && now - provenAt < SESSION_PROVEN_WINDOW_MS;
}

/** Forgets the proof — the session's end, and a spec's reset. */
export function forgetSessionProof(): void {
  provenAt = null;
}
