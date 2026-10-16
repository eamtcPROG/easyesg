import type { Locale } from '@easyesg/i18n';
import { translate } from '../messages/catalogue';
import type { DomainError } from './domain.error';
import { problemTypeUri } from './problem-types';

/** What a person reads of a refusal: its type, and its title and detail in their language (NFR-79). */
export interface RefusalWords {
  readonly type: string;
  /** Omitted where the catalogue has none — never the slug, which is an internal identifier. */
  readonly title?: string;
  readonly detail?: string;
}

/**
 * A domain refusal worded for a reader — **the one rule for it** (task 218).
 *
 * `ProblemDetailsFilter` words the refusal a whole response answers with; a write that stores what it admits names
 * each refusal it set aside inside a success (§12.5.6's task-218 row (a)). Two copies of *type, title from the slug,
 * detail from the key* would be two places to drift, so both call this.
 */
export function refusalWords(input: { readonly refusal: DomainError; readonly locale: Locale }): RefusalWords {
  const { refusal, locale } = input;
  return {
    type: problemTypeUri(refusal.problemType),
    title: translate(locale, `problem.${refusal.problemType}.title`),
    detail: translate(locale, refusal.messageKey, refusal.params),
  };
}
