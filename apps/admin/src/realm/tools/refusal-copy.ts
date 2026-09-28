import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';

/**
 * The words for a write the api did not carry out — what `RefusalCallout` and `ExpiringRefusal` both draw.
 *
 * **Out of both components since 28 Sep 2026**, when a refusal to a submit began leaving after a while
 * (`design_spec.md` §8.1) and a refused read did not: two renderers over one rule, and the rule is here once so they
 * cannot disagree about it. **The api's `detail` is the whole of NFR-79's *what now***, so a refusal's action is
 * `null`; an api that could not be reached said nothing, and gets the realm's three parts.
 */
export interface RefusalCopy {
  readonly title: string;
  readonly body: string;
  readonly action: string | null;
}

export const refusalCopy = (input: {
  readonly failure: ApiFailure;
  /** Used where the problem document carries no title of its own. */
  readonly title: string;
  /** Used where it carries no detail. */
  readonly fallback: string;
  /** The realm's words for no answer at all. */
  readonly unreachable: { readonly title: string; readonly body: string; readonly action: string };
}): RefusalCopy =>
  input.failure.status === API_OUTCOME.Problem
    ? {
        title: input.failure.problem.title ?? input.title,
        body: input.failure.problem.detail ?? input.fallback,
        action: null,
      }
    : { title: input.unreachable.title, body: input.unreachable.body, action: input.unreachable.action };
