/**
 * Which members an enumeration element offers, where that is narrower than its domain (task 79.7; §12.5.6's task-79.7
 * row) — a port because the answer is configuration (AD-4), read by the step read for a field's options and by the
 * write for what it refuses.
 */
export interface OfferedMembers {
  /**
   * By element key, the bare member names it offers — `ChildLabourMember`, never `vsme:ChildLabourMember`. An element
   * absent from the map offers its whole domain, which is every element but the ones the artefact names.
   */
  offered(query: { readonly standard: string }): ReadonlyMap<string, ReadonlySet<string>>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const OFFERED_MEMBERS = Symbol('OFFERED_MEMBERS');
