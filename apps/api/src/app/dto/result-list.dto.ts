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
  }) {
    this.objects = result.objects;
    this.total = result.total;
    this.totalpages = result.totalpages;
    this.htmlcode = result.htmlcode ?? 200;
    this.messages = result.messages ?? [];
  }
}
