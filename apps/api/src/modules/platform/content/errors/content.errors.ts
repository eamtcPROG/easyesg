import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * No article is in force under that key (task 76; UC-181; FR-61 AC-2). **One answer for an article never published and
 * one not in force** — a draft has no address (`architecture.md` §12.5.6's task-76 row (1)), so the reader is told
 * only that there is nothing here and where to look instead.
 */
export class HelpArticleNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.content.article_not_found');
  }
}
