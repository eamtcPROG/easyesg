import { PROBLEM_TYPE, type ProblemDocument, type ValidationFinding } from '@easyesg/contracts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** One finding as S-08's read names it — checked member by member, never cast (`outcome.ts`'s *validate, never cast*). */
const isFinding = (value: unknown): value is ValidationFinding =>
  isRecord(value) &&
  typeof value.rule === 'string' &&
  typeof value.verdict === 'string' &&
  typeof value.message === 'string' &&
  isRecord(value.params) &&
  Array.isArray(value.related) &&
  isRecord(value.field) &&
  typeof value.field.elementKey === 'string' &&
  typeof value.field.dimensionKey === 'string' &&
  typeof value.field.ordinal === 'number' &&
  Array.isArray(value.field.modules);

/**
 * What an export request refused for (FR-44; task 47.4): the report's unresolved findings, as the api evaluated them for
 * this request — the problem's `findings` member (`architecture.md` §12.5.6's task-47 row (l)).
 *
 * `null` where the refusal is something else. **A refusal of this kind whose list cannot be read answers an empty list,
 * never `null`**: the api has said the report holds unresolved findings, so the warning and its acknowledgement are still
 * owed — a list the browser could not read is a warning that names nothing, not an export that goes ahead unasked.
 */
export function refusedFindings(problem: ProblemDocument): readonly ValidationFinding[] | null {
  if (problem.type !== PROBLEM_TYPE.ExportFindingsUnacknowledged) return null;
  const listed = problem.extensions?.findings;
  return Array.isArray(listed) && listed.every(isFinding) ? listed : [];
}
