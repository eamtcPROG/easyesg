/**
 * Where FR-61's published content lives in the configuration store (task 76; `architecture.md` §12.5.6's task-76 row
 * (2)) — three kinds, **one slot per item** (FR-62 behaviour 6), each scoped by the item's key. Seeded from
 * `config/seed/help-topic.*.json` and `help-article.*.json`; the loader folds the filename's dash into an underscore,
 * so each kind is spelled with one here. No plan copy is seeded (row (7)).
 */
export const CONTENT_KIND = {
  /** S-32's *what you are doing* — a group of articles, its words help-centre text (OQ-43). */
  HELP_TOPIC: 'help_topic',
  HELP_ARTICLE: 'help_article',
  /** A plan's presentation copy, keyed by the plan's code (53.1); never a price (182/118). */
  PLAN_COPY: 'plan_copy',
} as const;

export type ContentKind = (typeof CONTENT_KIND)[keyof typeof CONTENT_KIND];

/**
 * An item's content key — `<kind>/<key>` — which the fallback queue files a gap under (row (4); 182/38's *key*). One
 * spelling, because the read that reports a gap and the watch that clears it must name the same row.
 */
export const contentKey = ({ kind, key }: { readonly kind: ContentKind; readonly key: string }): string =>
  `${kind}/${key}`;
