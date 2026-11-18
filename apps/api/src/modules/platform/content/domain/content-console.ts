import { LOCALES, isLocale, type Locale } from '@easyesg/i18n';
import { CONTENT_KIND, type ContentKind } from '../constants/content.constants';
import { helpArticleRefusal } from './help-article';
import { helpTopicRefusal } from './help-topic';
import { planCopyRefusal } from './plan-copy';

/**
 * A-03's pure rules (task 67.5; §12.5.6's task-67.5 row) — what an item's key may be, which locales a payload carries,
 * whether its reader would read it, and which locales a set's sign-off must name.
 */

/** Lower-case words joined by hyphens, at most 80 characters — the seed's file names, and an address segment on S-33. */
export const isContentKey = (key: string): boolean => key.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key);

const REFUSAL: Readonly<Record<ContentKind, (payload: unknown) => string | null>> = {
  [CONTENT_KIND.HELP_TOPIC]: helpTopicRefusal,
  [CONTENT_KIND.HELP_ARTICLE]: helpArticleRefusal,
  [CONTENT_KIND.PLAN_COPY]: planCopyRefusal,
};

/** Whether the kind's reader would read the payload — the store's own publication rule, asked ahead of time. */
export const isPublishable = (input: { readonly kind: ContentKind; readonly payload: unknown }): boolean =>
  REFUSAL[input.kind](input.payload) === null;

/** The locales a payload carries a block for, in the registry's order; an unregistered code is not counted. */
export const payloadLocales = (payload: unknown): readonly Locale[] => {
  if (typeof payload !== 'object' || payload === null || !('locales' in payload)) return [];
  const { locales } = payload;
  if (typeof locales !== 'object' || locales === null) return [];
  const present = Object.keys(locales).filter(isLocale);
  return LOCALES.filter((locale) => present.includes(locale));
};

/** Every locale any payload of a set carries — what the publication's sign-off must name (NFR-23; 182/37). */
export const setLocales = (payloads: readonly unknown[]): readonly Locale[] => {
  const present = new Set(payloads.flatMap((payload) => payloadLocales(payload)));
  return LOCALES.filter((locale) => present.has(locale));
};
