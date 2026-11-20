import { CONTENT_KIND, type ContentKind } from '@easyesg/contracts';

/** How A-03 names each kind (task 67.5) — the wire's snake_case meets the catalogue's camelCase here, once. */
export const CONTENT_KIND_LABEL = {
  [CONTENT_KIND.HELP_TOPIC]: 'helpTopic',
  [CONTENT_KIND.HELP_ARTICLE]: 'helpArticle',
  [CONTENT_KIND.PLAN_COPY]: 'planCopy',
} as const satisfies Record<ContentKind, string>;
