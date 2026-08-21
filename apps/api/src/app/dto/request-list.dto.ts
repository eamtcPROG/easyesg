import { ApiProperty } from '@nestjs/swagger';

export class RequestFilterDto {
  @ApiProperty() field: string;
  @ApiProperty({ type: [String] }) values: string[];
  constructor(field: string, values: string[]) {
    this.field = field;
    this.values = values;
  }
}

/**
 * The sort vocabulary of §6.8's compact list format, as an `as const` object with its union and
 * its contract surface both derived (CLAUDE.md, "Conventions"). It had been a hand-written union
 * with `['asc', 'desc']` restated in the `@ApiProperty` below — two copies of one closed set, and
 * the published enum was the copy that could drift silently.
 */
export const SORT_DIRECTION = { ASC: 'asc', DESC: 'desc' } as const;

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

/** Membership decided from the object, so a member added there is accepted here by construction. */
export const isSortDirection = (value: string): value is SortDirection =>
  (Object.values(SORT_DIRECTION) as string[]).includes(value);

export class RequestSortCriteriaDto {
  @ApiProperty() field: string;
  @ApiProperty({ enum: Object.values(SORT_DIRECTION) }) direction: SortDirection;
  constructor(field: string, direction: SortDirection) {
    this.field = field;
    this.direction = direction;
  }
}

/**
 * Parsed form of the list query. Produced by ListQueryInterceptor, never bound
 * directly from the wire — the compact encoding is not expressible as a plain DTO.
 */
export class RequestListDto {
  filters: RequestFilterDto[] = [];
  order: RequestSortCriteriaDto[] = [];
  page: number = 1;
  onpage: number = 25;

  get skip(): number {
    return this.onpage < 0 ? 0 : (this.page - 1) * this.onpage;
  }

  get take(): number | undefined {
    return this.onpage < 0 ? undefined : this.onpage;
  }
}
