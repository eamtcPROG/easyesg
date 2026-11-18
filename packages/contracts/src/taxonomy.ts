import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * The taxonomy's closed vocabularies as both front ends read them (tasks 67.6, 67.7, 67.20; FR-65 … FR-70; 182/39 …
 * 182/43) — a field's kind of change and a pair's determination, which A-04 authors and S-49 shows; an EFRAG label's
 * change between two versions, which A-04's diff lists; and where a report stands in a migration run, which A-04 counts.
 * Each is **held** to the generated enum, so a member the api adds or drops fails this file's compilation.
 */
export const TAXONOMY_FIELD_CHANGE = {
  ADDED: 'added',
  REMOVED: 'removed',
  ALTERED: 'altered',
} as const;

export type TaxonomyFieldChange = (typeof TAXONOMY_FIELD_CHANGE)[keyof typeof TAXONOMY_FIELD_CHANGE];

export const TAXONOMY_FIELD_CHANGE_MIRRORS_WIRE: SameSet<TaxonomyFieldChange, components['schemas']['MappedFieldDto']['change']> = true;
export const REVIEWED_FIELD_CHANGE_MIRRORS_WIRE: SameSet<
  TaxonomyFieldChange,
  components['schemas']['ReviewedFieldResponseDto']['change']
> = true;

export const TAXONOMY_COMPATIBILITY = {
  COMPATIBLE: 'compatible',
  BREAKING: 'breaking',
} as const;

export type TaxonomyCompatibility = (typeof TAXONOMY_COMPATIBILITY)[keyof typeof TAXONOMY_COMPATIBILITY];

export const TAXONOMY_COMPATIBILITY_MIRRORS_WIRE: SameSet<
  TaxonomyCompatibility,
  components['schemas']['VersionMappingResponseDto']['determination']
> = true;

export const LABEL_CHANGE = {
  ADDED: 'added',
  REMOVED: 'removed',
  CHANGED: 'changed',
} as const;

export type LabelChange = (typeof LABEL_CHANGE)[keyof typeof LABEL_CHANGE];

export const LABEL_CHANGE_MIRRORS_WIRE: SameSet<LabelChange, components['schemas']['LabelDiffEntryResponseDto']['change']> = true;

export const REPORT_MIGRATION_STATUS = {
  MIGRATED: 'migrated',
  AWAITING_REVIEW: 'awaiting_review',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVERTED: 'reverted',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type ReportMigrationStatus = (typeof REPORT_MIGRATION_STATUS)[keyof typeof REPORT_MIGRATION_STATUS];

export const REPORT_MIGRATION_STATUS_MIRRORS_WIRE: SameSet<
  ReportMigrationStatus,
  components['schemas']['MigrationTallyEntryResponseDto']['status']
> = true;
