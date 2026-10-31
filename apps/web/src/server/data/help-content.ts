import { cache } from 'react';
import type { HelpArticle, HelpArticleSummary, HelpTopic } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { api } from '@/server/api/api-client';

/**
 * FR-61's published help content, read with no session (task 76's routes; task 77, UC-180, UC-181) — what S-32 and
 * S-33 render. **The language is in the address**, never negotiated: the help centre reads in the page's locale, and an
 * item with no text in it comes back in Romanian, saying so in its own `locale`.
 *
 * `cache()`d per request, so a page and its metadata read one library.
 */
export const readHelpTopics = cache((locale: Locale) =>
  api.getList<HelpTopic>(`/content/help/topics?locale=${locale}`),
);

export const readHelpArticles = cache((locale: Locale) =>
  api.getList<HelpArticleSummary>(`/content/help/articles?locale=${locale}`),
);

export const readHelpArticle = cache((key: string, locale: Locale) =>
  api.get<HelpArticle>(`/content/help/articles/${encodeURIComponent(key)}?locale=${locale}`),
);
