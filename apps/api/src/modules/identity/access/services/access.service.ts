import { Injectable } from '@nestjs/common';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { ListQueryInput } from '@api/contracts/types/list-query';
import { toAccessQuery } from '../domain/access-query';
import { ListAccess } from '../use-cases/list-access.use-case';
import { ReadSeatConsumption } from '../use-cases/read-seat-consumption.use-case';
import type { AccessPage, AccessQuery } from '../models/access.model';
import type { SeatConsumption } from '../models/seat-consumption.model';

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
  constructor(
    private readonly listAccess: ListAccess,
    private readonly readSeatConsumption: ReadSeatConsumption,
  ) {}

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

  /**
   * S-16's seat region (task 142) — the one read here that needs ambient context, and the reason
   * this layer earns its keep for it: the organization reaches `SeatAllowance`'s query from
   * `AuthGuard`'s lookup, never from a caller.
   *
   * `@RequiresRole(OA)` has already refused a request with no bound organization; this throws rather
   * than trusting that, for `InvitationService.boundOrganization`'s reason — a guard is a
   * declaration, and this is the layer that would otherwise ask about `undefined`.
   */
  seats(): Promise<SeatConsumption> {
    const organizationId = requestContext()?.organizationId;
    if (!organizationId) throw new AuthenticationRequiredError();
    return this.readSeatConsumption.execute({ organizationId });
  }
}
