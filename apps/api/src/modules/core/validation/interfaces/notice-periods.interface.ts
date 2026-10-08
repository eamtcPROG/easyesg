import type { LegalDate } from '@api/contracts/types/time';

/** One period as its check reads it, bound to its organization (task 51.2). */
export interface NoticePeriod {
  readonly periodId: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  readonly timezone: string;
  readonly dueDate: LegalDate | null;
  /** Read again at the check, which may run after the sweep: a period locked since owes nothing. */
  readonly locked: boolean;
  readonly archived: boolean;
  readonly report: {
    readonly reportId: string;
    readonly createdAt: Date;
    /** The report's pinned version (DR-4), which the notice names its fields by. */
    readonly taxonomyVersion: string;
  } | null;
}

/** The period a check is about, and who its notices reach — both bound to its organization (task 51.2). */
export interface NoticePeriods {
  find(query: { readonly periodId: string }): Promise<NoticePeriod | null>;
  /** The members with edit access, the Editors and the Organization Administrator (FR-164's actors; 182/135). */
  editors(): Promise<readonly string[]>;
}

export const NOTICE_PERIODS = Symbol('NOTICE_PERIODS');
