/**
 * The FR-18 snapshot following its entity until B1 is opened — FR-27 as amended 30 Sep 2026 (task 180.2;
 * `architecture.md` §12.5.6's task-180.2 row).
 *
 * **Its own port rather than a method on `ReportingPeriodStore`**, because its caller is the entity's save and not the
 * period's screens: an entity use case that depended on the whole period store would depend on opening, locking and
 * listing periods it never does (the interface-segregation rule the root `CLAUDE.md` binds to `contracts/`'s ports,
 * applied between two modules of one context). The period store's adapter implements both, since it is the one place a
 * snapshot is written.
 */
export const ENTITY_SNAPSHOT_REFRESH = Symbol('ENTITY_SNAPSHOT_REFRESH');

export interface EntitySnapshotRefresh {
  /**
   * Re-take the snapshot of every period of this entity that is not locked and whose report stores none of the answers
   * the record gives — B1 not yet opened, or no report yet — and point those periods at it. **One operation**, in the
   * caller's transaction, so the entity's save and its periods' copy commit together or not at all.
   *
   * Returns how many periods now hold the new copy; none is an ordinary answer — every period locked, or B1 opened.
   */
  followRecord(input: { readonly reportingEntityId: string; readonly at: Date }): Promise<number>;
}
