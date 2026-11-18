import type { ApplicabilityRule } from '../models/applicability.model';

/**
 * What a threshold change's notice reads (task 67.8; FR-166, UC-81; 182/135 … 182/137), as three narrow ports — each
 * consumer depends on the one it calls (interface segregation), and none of them is the wizard's own rules port, which
 * answers only what is in force.
 */

/** The rules a revision held — the one leaving and the one entering — read by revision, never as in force. */
export interface ApplicabilityHistory {
  /** `null` where the revision was never published or its payload holds no rule list. */
  rulesAt(query: { readonly standard: string; readonly revision: number }): Promise<readonly ApplicabilityRule[] | null>;
}

export const APPLICABILITY_HISTORY = Symbol('APPLICABILITY_HISTORY');

/** Every open report, by organization, read with no organization bound — which organizations a change could reach. */
export interface OpenReportDirectory {
  openReports(): Promise<readonly { readonly organizationId: string; readonly reportIds: readonly string[] }[]>;
}

export const OPEN_REPORT_DIRECTORY = Symbol('OPEN_REPORT_DIRECTORY');

/** One organization's reports as a notice names them, and who it reaches — read bound to that organization. */
export interface ReportUpdateSubjects {
  subjects(query: { readonly reportIds: readonly string[] }): Promise<
    readonly { readonly reportId: string; readonly entityName: string; readonly fiscalYear: number }[]
  >;
  /** The Editors and the Organization Administrator (182/135). */
  editors(): Promise<readonly string[]>;
}

export const REPORT_UPDATE_SUBJECTS = Symbol('REPORT_UPDATE_SUBJECTS');
