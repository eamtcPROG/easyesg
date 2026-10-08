import type { FieldAddress } from '@easyesg/validation';
import type { CurrentAnswer } from '../models/outstanding-cleared';

/**
 * What the report's last validation run left outstanding, and the listed fields' rows as they stand (task 51.2) — what a
 * write is judged against when it may have cleared FR-164's notice. A read of validation's stored result, through this
 * module's own port, as the report's readiness is read (`readyToFileOf`).
 */
export interface LastRunOutstanding {
  /** The fields the last run listed, and when it ran; `null` for a report never validated. */
  of(query: { readonly reportId: string }): Promise<{ readonly ranAt: Date; readonly fields: readonly FieldAddress[] } | null>;
  /** The rows standing at those fields now, each with when it was last written; a field with no row has none. */
  answers(query: { readonly reportId: string; readonly fields: readonly FieldAddress[] }): Promise<readonly CurrentAnswer[]>;
}

export const LAST_RUN_OUTSTANDING = Symbol('LAST_RUN_OUTSTANDING');
