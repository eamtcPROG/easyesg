import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import {
  DEFAULT_ON_PAGE, DEFAULT_PAGE, LIST_GROUP_SEPARATOR, LIST_VALUE_SEPARATOR,
  MAX_ON_PAGE, ON_PAGE_ALL,
} from '../constants/pagination.constants';
import { RequestFilterDto, RequestListDto, RequestSortCriteriaDto } from '../dto/request-list.dto';

declare module 'express' {
  interface Request {
    requestList?: RequestListDto;
  }
}

/**
 * Parses the compact list wire format into `req.requestList`.
 *
 *   ?filters=field,v1,v2|field2,v3 & order=field,asc|other,desc & page=1 & onpage=25
 *
 * Opt-in per handler with `@UseInterceptors(ListQueryInterceptor)` — routes that do
 * not list should not silently accept list parameters.
 *
 * Deliberate trade, recorded because it will look like an oversight later: OpenAPI
 * describes this encoding only as three strings, so the generated client in
 * `packages/contracts` types them loosely. NFR-83's contract tests and NFR-16's
 * route-coverage diff are unaffected — they check routes, status codes and security,
 * not query grammar.
 */
@Injectable()
export class ListQueryInterceptor implements NestInterceptor {
  /**
   * @param bounded whether this route may serve `onpage=-1` (all rows). Default false:
   *   anything backed by an append-only store retains for six years, so "all rows" is
   *   an outage waiting for the right tenant.
   */
  constructor(
    private readonly bounded = false,
    private readonly maxOnPage = MAX_ON_PAGE,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const q = req.query as Record<string, string | undefined>;
    const list = new RequestListDto();

    list.filters = this.parseGroups(q.filters, (parts) =>
      parts.length < 2 ? null : new RequestFilterDto(parts[0], parts.slice(1)));

    list.order = this.parseGroups(q.order, (parts) => {
      const dir = (parts[1] ?? 'asc').toLowerCase();
      if (dir !== 'asc' && dir !== 'desc') {
        throw new BadRequestException(`Sort direction must be asc or desc, received "${parts[1]}"`);
      }
      return new RequestSortCriteriaDto(parts[0], dir);
    });

    list.page = this.parsePositiveInt(q.page, DEFAULT_PAGE);
    list.onpage = this.parseOnPage(q.onpage);

    req.requestList = list;
    return next.handle();
  }

  private parseGroups<T>(raw: string | undefined, build: (parts: string[]) => T | null): T[] {
    if (!raw) return [];
    return raw
      .split(LIST_GROUP_SEPARATOR)
      .map((group) => group.split(LIST_VALUE_SEPARATOR).map((v) => v.trim()).filter(Boolean))
      .filter((parts) => parts.length > 0)
      .map(build)
      .filter((v): v is T => v !== null);
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (raw === undefined) return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException(`page must be a positive integer, received "${raw}"`);
    }
    return n;
  }

  private parseOnPage(raw: string | undefined): number {
    if (raw === undefined) return DEFAULT_ON_PAGE;
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n)) {
      throw new BadRequestException(`onpage must be an integer, received "${raw}"`);
    }
    if (n === ON_PAGE_ALL) {
      if (!this.bounded) {
        throw new BadRequestException(
          'onpage=-1 is not available on this route: it is backed by an append-only store.',
        );
      }
      return ON_PAGE_ALL;
    }
    if (n < 1) {
      throw new BadRequestException(`onpage must be positive or -1, received "${raw}"`);
    }
    // Clamp rather than reject: a caller asking for too much gets less, not an error.
    return Math.min(n, this.maxOnPage);
  }
}
