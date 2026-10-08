import type { Finding } from '@easyesg/validation';

/**
 * The findings a reader is shown (task 41.2; FR-43 item 6, AC-8; 182/26): **the last run's, except those whose field
 * has left the report's scope since** — a field ruled out by B1, a section or module declared omitted, a module the
 * report's scope no longer asks. The api evaluates only when asked, so findings are as old as the run; but a finding
 * about a field that no longer applies is not stale, it is wrong, and it is dropped at read rather than left until the
 * next run.
 *
 * By the field the finding sits on: a finding is about its own field, and the fields it relates to are links beside it.
 */
export const findingsInScope = (input: {
  readonly findings: readonly Finding[];
  readonly scope: ReadonlyMap<string, readonly string[]>;
}): readonly Finding[] => input.findings.filter((finding) => input.scope.has(finding.field.elementKey));
