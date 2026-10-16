import { DomainError } from './domain.error';
import type { ProblemTypeSlug } from './problem-types';

/**
 * A request every item of which was refused for its own sake (task 218; §12.5.6's task-218 row (a), (b)).
 *
 * **It answers as its first refusal does** — that refusal's status, type and wording — so a request carrying one bad
 * value reads exactly as it did before a write learned to store what it admits. What it adds is the `refused`
 * extension, listing every item with its own wording; **its presence is what tells a client the refusal is about
 * those items rather than the report**, and so that the rest of its queue may still go.
 */
export class ItemsRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug;
  readonly status: number;

  constructor(input: { readonly first: DomainError; readonly refused: readonly object[] }) {
    super(input.first.messageKey, input.first.params, { refused: input.refused });
    this.problemType = input.first.problemType;
    this.status = input.first.status;
  }
}
