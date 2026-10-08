import { FINDING_WEIGHT, type FindingWeight } from '@easyesg/ui';
import { VERDICT, type Verdict } from '@easyesg/validation';

/**
 * **What S-08 calls a finding's weight** (task 42.2; `architecture.md` §12.5.6's task-42 row (b); `design_spec.md`
 * S-08's amendment of 8 Oct 2026) — the Reporting Core artboard's two words: *must fix* where the report would be wrong
 * or incomplete as filed, *review* where it looks unusual and a person decides. The field keeps §6.4's marker; this is
 * the panel's sorting of the same verdict. Nothing is gated by either (182/27).
 *
 * Exhaustive by `Record`: a verdict the interpreter gains fails here rather than landing in a panel with no weight.
 */
const WEIGHT_OF_VERDICT: Readonly<Record<Verdict, FindingWeight>> = {
  [VERDICT.MISSING_VALUE]: FINDING_WEIGHT.MUST_FIX,
  [VERDICT.ERROR]: FINDING_WEIGHT.MUST_FIX,
  [VERDICT.INVALID_URL]: FINDING_WEIGHT.MUST_FIX,
  [VERDICT.VALUE_INCONSISTENCY]: FINDING_WEIGHT.REVIEW,
};

export const weightOf = (verdict: Verdict): FindingWeight => WEIGHT_OF_VERDICT[verdict];
