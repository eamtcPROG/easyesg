import { ProblemTypeSlug } from './problem-types';

/**
 * Base for errors that map to a registered problem type.
 *
 * Domain and use-case code throws these. It must not throw HttpException — that would
 * put a NestJS type inside the layers CLAUDE.md forbids it in, and the mapping from
 * domain failure to HTTP status is an interface-adapter concern.
 */
export abstract class DomainError extends Error {
  abstract readonly problemType: ProblemTypeSlug;
  abstract readonly status: number;

  /** Extension members merged into the problem document (e.g. limit, allowance). */
  readonly extensions: Record<string, unknown> = {};

  protected constructor(message: string, extensions: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.extensions = extensions;
  }
}
