import type { ContentKind } from '../constants/content.constants';
import type {
  ContentDraft,
  ContentFallbackEntry,
  ContentItem,
  ContentItemRef,
  LocaleRegistrationView,
} from '../models/content-console.model';

/** A locale's sign-off, as the publication records it (182/37). */
export interface ContentSignOff {
  readonly by: string;
  readonly at: Date;
}

/**
 * A-03's store (task 67.5) — the configuration store's drafts, publications and reverts for FR-61's three kinds, and
 * FR-64's queue. **Its adapter maps the store's infrastructure errors onto this module's refusals**, as A-17's and
 * A-18's do, so no use case learns the store is generic.
 */
export interface ContentConsoleStore {
  items(): Promise<readonly ContentItem[]>;
  fallbacks(): Promise<readonly ContentFallbackEntry[]>;
  registration(): Promise<LocaleRegistrationView>;

  saveDraft(input: {
    readonly kind: ContentKind;
    readonly key: string;
    readonly payload: Record<string, unknown>;
    readonly operatorId: string;
  }): Promise<ContentDraft>;
  /** Null where the item has no draft to submit. */
  submitDraft(item: ContentItemRef): Promise<ContentDraft | null>;
  /** The discarded draft's id, or null where there was none. */
  discardDraft(item: ContentItemRef): Promise<string | null>;

  /**
   * Every item's draft in review, published by one transaction (67.14), the sign-off of each locale on the publication
   * (67.15). Throws `ContentDraftMissingError` or `ContentPayloadRefusedError`, rolling the whole set back.
   */
  publishReviewed(input: {
    readonly items: readonly ContentItemRef[];
    readonly signOff: Readonly<Record<string, ContentSignOff>>;
    readonly operatorId: string;
  }): Promise<{ readonly publicationId: string }>;

  /** The item's previous version put back in force (NFR-85) — null where there is none. */
  revert(item: ContentItemRef): Promise<{ readonly id: string; readonly revision: number } | null>;

  /** The organizations a publication reaches — every one — read through the logged cross-tenant door. */
  organizationCount(input: { readonly requesterId: string }): Promise<number>;

  /** Throws `LocaleRegistrationChangedError` where the revision in force is not `expectedRevision`. */
  publishRegistration(input: {
    readonly codes: readonly string[];
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }>;
}

export const CONTENT_CONSOLE_STORE = Symbol('CONTENT_CONSOLE_STORE');
