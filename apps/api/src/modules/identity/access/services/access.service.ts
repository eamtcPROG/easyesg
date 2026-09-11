import { Injectable } from '@nestjs/common';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { toAccessQuery, type ListQueryInput } from '../domain/access-query';
import { ListAccess } from '../use-cases/list-access.use-case';
import type { AccessPage, AccessQuery } from '../models/access.model';

/**
 * The Nest-aware seam between `AccessController` and the use case (house rule, 20 Aug 2026:
 * controllers call services, services call use cases — enforced by `controllers-not-to-use-cases`
 * rather than by review, which is how this file came to exist at all).
 *
 * One method, one call. That is the honest minimum rather than the pass-through `CLAUDE.md` warns
 * about: the seam **is** the rule, and it is where ambient request context would be resolved if this
 * read needed any. It needs none — the organization comes from RLS and the query from the parsed URL
 * — so there is nothing for this layer to add and nothing for a caller to supply.
 *
 * The query is taken whole rather than destructured into parameters, so a facet added to
 * `AccessQuery` arrives here without touching this file (CLAUDE.md, "An application-boundary call
 * takes one object" — and six of its members are `string`s and `number`s that would be swappable
 * positionally).
 */
@Injectable()
export class AccessService {
  constructor(private readonly listAccess: ListAccess) {}

  /**
   * The parsed list query, narrowed to what this screen can be asked.
   *
   * Here rather than in the controller because `controllers-not-to-use-cases` covers `domain/` as
   * well — and the rule is right about this one: *which* facets exist and what an unreadable one
   * falls back to are the read model's decisions, not the HTTP layer's. The controller's job is to
   * hand over what the interceptor parsed.
   */
  narrow(parsed: ListQueryInput): AccessQuery {
    return toAccessQuery(parsed, DEFAULT_ON_PAGE);
  }

  list(query: AccessQuery): Promise<AccessPage> {
    return this.listAccess.execute(query);
  }
}
