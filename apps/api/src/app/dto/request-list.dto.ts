import { ApiProperty } from '@nestjs/swagger';

export class RequestFilterDto {
  @ApiProperty() field: string;
  @ApiProperty({ type: [String] }) values: string[];
  constructor(field: string, values: string[]) {
    this.field = field;
    this.values = values;
  }
}

export type SortDirection = 'asc' | 'desc';

export class RequestSortCriteriaDto {
  @ApiProperty() field: string;
  @ApiProperty({ enum: ['asc', 'desc'] }) direction: SortDirection;
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
