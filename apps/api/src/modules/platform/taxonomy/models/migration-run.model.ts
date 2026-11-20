import type { Compatibility } from '../domain/version-mapping';
import type { MigrationTally } from '../domain/migration-run';

/**
 * A-04's migration runs as the console reads them (tasks 67.23, 67.7; UC-78; 182/43): **counts and outcomes, never a
 * value** — which reports, by number per organization, and where each stands. D-5 holds because nothing here is read
 * from a report but its pin and its standing.
 */
export interface MigrationRunSummary {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly toTemplateVersion: string;
  /** The pair's determination when the run started, which decided how each report landed. */
  readonly determination: Compatibility;
  readonly requestedAt: Date;
  /** The operator's address; null where their account no longer reads. */
  readonly requestedBy: string | null;
  readonly revertedAt: Date | null;
  readonly selected: number;
  readonly pending: number;
  readonly tally: MigrationTally;
}

export interface MigrationRunOrganization {
  readonly organizationId: string;
  readonly name: string;
  readonly selected: number;
  readonly pending: number;
  readonly tally: MigrationTally;
}

export interface MigrationRunDetail extends MigrationRunSummary {
  readonly organizations: readonly MigrationRunOrganization[];
}

/** UX-123's blast radius before a run starts: what it would select, and what it leaves out as read-only. */
export interface MigrationSelectionPreview {
  readonly determination: Compatibility;
  readonly reports: number;
  readonly organizations: number;
  /** Reports on the version that a run cannot move — a locked period or an archived entity. */
  readonly leftOut: number;
}
