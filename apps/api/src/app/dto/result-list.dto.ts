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

  constructor(objects: T[], total: number, totalpages: number, htmlcode = 200, messages: MessageDto[] = []) {
    this.objects = objects;
    this.total = total;
    this.totalpages = totalpages;
    this.htmlcode = htmlcode;
    this.messages = messages;
  }
}
