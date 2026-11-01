import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

/** Success envelope for a list. Paired with RequestListDto on the way in. */
export class ResultListDto<T> {
  @ApiProperty({ example: 200 })
  htmlcode: number;

  @ApiProperty({ isArray: true })
  objects: T[];

  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 6 })
  totalpages: number;

  @ApiProperty({ type: [MessageDto] })
  messages: MessageDto[];

  /**
   * Rows **before** the filter, where a route filters and the difference matters (task 131).
   *
   * `total` is what the pager divides: rows surviving the filter. That is the right answer for
   * paging and the wrong one for an empty result, which needs to know whether there is nothing
   * *yet* or nothing *matching* — §4.6 requires an Index's empty state to teach, and those two
   * teach opposite things. `IndexShell` in `packages/ui` takes both for exactly this reason.
   *
   * **Optional, and absent rather than equal to `total` on routes that do not filter.** Setting it
   * unconditionally would publish a number every unfiltered list would have to justify, and would
   * make "no filter is applied" indistinguishable from "the filter admitted everything".
   */
  @ApiProperty({
    type: Number,
    required: false,
    description:
      'Rows before any filter was applied. Present only on routes that accept filters; `total` is ' +
      'the count after filtering and is what pages are counted from.',
  })
  unfiltered?: number;

  /**
   * One named input rather than five positional arguments (CLAUDE.md, "Conventions"). `total` and
   * `totalpages` are adjacent `number`s: swapping them compiles and produces a paginator that
   * reports the page count as the row count — a wrong answer that looks like a plausible one, on
   * every list endpoint at once.
   */
  constructor(result: {
    objects: T[];
    total: number;
    totalpages: number;
    htmlcode?: number;
    messages?: MessageDto[];
    unfiltered?: number;
  }) {
    this.objects = result.objects;
    this.total = result.total;
    this.totalpages = result.totalpages;
    this.htmlcode = result.htmlcode ?? 200;
    this.messages = result.messages ?? [];
    // Left undefined rather than defaulted, so the property is absent from the JSON on every route
    // that does not filter — see the field's own note.
    if (result.unfiltered !== undefined) this.unfiltered = result.unfiltered;
  }
}
