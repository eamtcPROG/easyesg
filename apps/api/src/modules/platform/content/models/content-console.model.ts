import type { Locale } from '@easyesg/i18n';
import type { ContentKind } from '../constants/content.constants';

/**
 * A-03's view of FR-61's content (task 67.5; UC-71 … UC-74; §12.5.6's task-67.5 row) — each item's version in force,
 * its open draft, and whether there is an earlier version to put back. Payloads travel whole: the console edits what
 * the store holds, and the kind's reader judges it at publication.
 */
export const CONTENT_DRAFT_STATE = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
} as const;

export type ContentDraftState = (typeof CONTENT_DRAFT_STATE)[keyof typeof CONTENT_DRAFT_STATE];

export interface ContentVersionInForce {
  readonly revision: number;
  readonly payload: Record<string, unknown>;
  readonly publishedAt: Date;
  /** The operator who published it, by address; null for the seed. */
  readonly publishedBy: string | null;
  /** Whether an earlier version exists to put back in one step (UX-123). */
  readonly revertible: boolean;
}

export interface ContentDraft {
  readonly id: string;
  readonly revision: number;
  readonly state: ContentDraftState;
  readonly payload: Record<string, unknown>;
  readonly draftedAt: Date;
  /** The operator who last saved it, by address. */
  readonly draftedBy: string | null;
}

export interface ContentItem {
  readonly kind: ContentKind;
  readonly key: string;
  readonly inForce: ContentVersionInForce | null;
  readonly draft: ContentDraft | null;
}

/** One row of FR-64's queue: a key read in a locale it lacks, how often and since when (182/38). */
export interface ContentFallbackEntry {
  readonly contentKey: string;
  readonly locale: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly occurrences: number;
}

/** The locale registration in force (task 67.16), with the revision the console edits against. */
export interface LocaleRegistrationView {
  readonly revision: number;
  readonly codes: readonly string[];
}

export interface ContentConsole {
  readonly items: readonly ContentItem[];
  readonly fallbacks: readonly ContentFallbackEntry[];
  readonly registration: LocaleRegistrationView;
}

/** An item a publication names. */
export interface ContentItemRef {
  readonly kind: ContentKind;
  readonly key: string;
}

/** UX-123's preview of a set: what each item would carry, and who it reaches. */
export interface ContentPublicationPreview {
  readonly items: readonly {
    readonly kind: ContentKind;
    readonly key: string;
    /** Whether a draft in review is there to publish, and its reader would read it. */
    readonly publishable: boolean;
    /** The locales the draft carries; a reader in any other is served Romanian (FR-64). */
    readonly locales: readonly Locale[];
    /** Whether it replaces a version in force, which a revert can then put back. */
    readonly replaces: boolean;
  }[];
  /** Every locale any item carries — each needs its sign-off (NFR-23). */
  readonly locales: readonly Locale[];
  /** Every organization reads the help centre and the plans; no report's content changes. */
  readonly reach: { readonly organizations: number; readonly reports: number };
}
