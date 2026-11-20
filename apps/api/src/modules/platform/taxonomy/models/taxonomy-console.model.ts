import type { Locale } from '@easyesg/i18n';
import type { TaxonomyVersionMapping } from '@api/contracts/taxonomy-mapping.port';

/**
 * A-04's view of the taxonomy (tasks 67.21, 67.22, 67.6; UC-75 … UC-77; §12.5.6's task-67.21 row) — the versions the
 * store registers, the ones the release carries and nobody has registered yet, the adoption schedule, and each pair's
 * mapping with the revision a change is made against.
 */
export interface RegisteredVersion {
  readonly version: string;
  /** EFRAG's template releases registered against it — `1.3.0`. */
  readonly templateVersions: readonly string[];
}

export interface AdoptionWindow {
  /** Inclusive calendar day; null for a window open to the past. */
  readonly validFrom: string | null;
  /** Exclusive calendar day; null for the open window. */
  readonly validTo: string | null;
  readonly version: string;
  readonly templateVersion: string;
  readonly revision: number;
}

export interface StoredMapping extends TaxonomyVersionMapping {
  readonly revision: number;
}

export interface TaxonomyConsole {
  readonly versions: readonly RegisteredVersion[];
  /** Versions whose artefacts are committed under `config/taxonomy-candidates/` and not yet registered (182/48). */
  readonly candidates: readonly string[];
  readonly adoption: readonly AdoptionWindow[];
  readonly mappings: readonly StoredMapping[];
}

/** UC-77's exposure (task 67.22; FR-68; 182/49): reports on a version older than the newest registered — counts only. */
export interface TaxonomyExposure {
  readonly newest: string | null;
  readonly versions: readonly { readonly version: string; readonly reports: number; readonly organizations: number }[];
  readonly organizations: readonly {
    readonly organizationId: string;
    readonly name: string;
    readonly versions: readonly { readonly version: string; readonly reports: number }[];
  }[];
}

/** One element's EFRAG label, changed between a pair's two versions in a locale EFRAG translates (A-04, task 67.6). */
export const LABEL_CHANGE = {
  ADDED: 'added',
  REMOVED: 'removed',
  CHANGED: 'changed',
} as const;

export type LabelChange = (typeof LABEL_CHANGE)[keyof typeof LABEL_CHANGE];

export interface LabelDiffEntry {
  readonly element: string;
  readonly change: LabelChange;
  readonly before: string | null;
  readonly after: string | null;
}

export interface LabelDiff {
  readonly from: string;
  readonly to: string;
  readonly locale: Locale;
  /** Whether EFRAG publishes this locale's labels for both versions; where not, there is no official diff to show. */
  readonly official: boolean;
  readonly entries: readonly LabelDiffEntry[];
}
