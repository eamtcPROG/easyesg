/**
 * S-16's seat region, as the API answers it (task 142; UX-50, UX-52).
 *
 * **Two numbers, and the screen derives the rest.** How many remain, whether one left is a warning
 * and whether none left is the gate are presentation rules over these two facts; publishing them
 * would put a threshold UX-52 owns into the wire.
 */
export interface SeatConsumption {
  /**
   * The ceiling in force, or **null when it cannot be read** — which S-16 draws as the count being
   * unavailable, and which the gates answer by refusing (fail closed, §12.5.6).
   */
  readonly allowance: number | null;
  /** Active members plus every pending invitation, lapsed included — the rows S-16 lists. */
  readonly used: number;
}
