import type { TaxonomyMappedField } from '@api/contracts/taxonomy-mapping.port';

/**
 * A migrated report awaiting its organization's decision (task 67.20; UC-78, UC-79; FR-69, FR-70; 182/43) — what
 * S-49 shows the Organization Administrator: the version the report moved from and to, when, and the fields the pair's
 * published mapping says changed, each by its label in the reader's language.
 */
export interface AwaitingMigration {
  readonly id: string;
  readonly runId: string;
  readonly from: string;
  readonly to: string;
  readonly migratedAt: Date;
}

export interface ReviewedField {
  readonly label: string;
  readonly change: TaxonomyMappedField['change'];
}

export interface MigrationReview extends AwaitingMigration {
  readonly fields: readonly ReviewedField[];
}
