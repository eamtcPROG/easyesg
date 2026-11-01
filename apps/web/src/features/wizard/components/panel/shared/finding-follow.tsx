'use client';

import { createContext, use } from 'react';

/**
 * **What a finding's link needs from the panel around it** (task 42.3; FR-42) — the step that is open, so a finding on
 * it is a fragment the browser follows in place rather than a step change, and what to do as one is followed, which is
 * to close the sheet S-08 is raised in below `wide`, so focus can land in the field behind it.
 *
 * **A context because the link is three components below the section that knows both**, through the body and the
 * groups that have no use for either — and since task 210 the report's entity, which a finding on its IDNO leads to.
 * The section provides it around both placements, the dock and the sheet.
 *
 * **In `shared/` because two of the panel's folders read it**: `section/` provides it, and `findings/` reads it — this
 * folder's admission test, and nothing else.
 */
export interface FindingFollow {
  /** The step that is open — a finding there is a fragment of this page. */
  readonly current: string;
  /** Called as a finding on the open step is followed, before the browser moves to its field. */
  readonly onFollow: () => void;
  /** The report's entity — a finding on a field its record answers leads to that record (task 210). */
  readonly entityId: string;
}

export const FindingFollowContext = createContext<FindingFollow | null>(null);

export function useFindingFollow(): FindingFollow {
  const value = use(FindingFollowContext);
  if (value === null) throw new Error('useFindingFollow must be used within ValidationSection (S-08).');
  return value;
}
