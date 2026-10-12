import type { DomainError } from '@api/app/filters/domain.error';
import { ReportEntityArchivedError, ReportNotEditableError } from '@api/modules/core/disclosure/errors/report.errors';
import { SQL_STATE, hasSqlState } from '../sql-state';

/**
 * **A write to a report the database refused, as the refusal it is** (tasks 31.2, 214) — the report-scoped guard's two
 * codes: `45002` where the report's entity is archived, `45001` where its period is locked. `null` where the error was
 * neither, for the caller to rethrow.
 *
 * **One reading for every store whose table the guard watches** — the report, its values, derivation inputs and the
 * calculator's sources and runs — which each translated `45001` on its own until the archive gave the guard a second
 * code: five copies would have had to learn it, and any one left behind would answer an archived report's write with a
 * bare database error.
 */
export function reportWriteRefusal(error: unknown): DomainError | null {
  if (hasSqlState(error, SQL_STATE.ARCHIVED)) return new ReportEntityArchivedError();
  if (hasSqlState(error, SQL_STATE.LOCKED)) return new ReportNotEditableError();
  return null;
}
