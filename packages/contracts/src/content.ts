import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * A-03's vocabularies (task 67.5) — the api's `CONTENT_KIND` and `CONTENT_DRAFT_STATE`, mirrored for the console, each
 * held to the generated contract at compile time, `ADMIN_ROLE`'s arrangement.
 */
export const CONTENT_KIND = {
  HELP_TOPIC: 'help_topic',
  HELP_ARTICLE: 'help_article',
  PLAN_COPY: 'plan_copy',
} as const;

export type ContentKind = (typeof CONTENT_KIND)[keyof typeof CONTENT_KIND];

export const CONTENT_KIND_MIRRORS_WIRE: SameSet<ContentKind, components['schemas']['ContentItemResponseDto']['kind']> =
  true;

export const CONTENT_DRAFT_STATE = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
} as const;

export type ContentDraftState = (typeof CONTENT_DRAFT_STATE)[keyof typeof CONTENT_DRAFT_STATE];

export const CONTENT_DRAFT_STATE_MIRRORS_WIRE: SameSet<
  ContentDraftState,
  components['schemas']['ContentDraftResponseDto']['state']
> = true;
