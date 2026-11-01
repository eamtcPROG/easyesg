import type { FactorSetPin } from '../models/factor-set.model';
import type { AffectedReport } from '../models/report-update.model';

/**
 * What one organization's notice is about and who it reaches (task 37.3) — read **bound to that organization**, inside
 * `TENANT_WORK`, so row-level security is what scopes both answers.
 */
export interface ReportUpdateAudience {
  /**
   * The organization's open reports whose latest run is pinned to the revision (row (3)): a locked, ready-to-file or
   * filed report cannot be recalculated (FR-22, FR-73), and an earlier run of a report is history.
   */
  affectedReports(pin: FactorSetPin): Promise<readonly AffectedReport[]>;

  /** The accounts of its active members with edit access — the Editors and the Organization Administrator (182/135). */
  editors(): Promise<readonly string[]>;
}

export const REPORT_UPDATE_AUDIENCE = Symbol('REPORT_UPDATE_AUDIENCE');
