import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

/**
 * Success envelope for a single resource.
 *
 * Note what is NOT here: the sibling projects carry an `error: boolean` and route
 * failures through this same shape. easyesg cannot — architecture.md §6.8 fixes
 * RFC 9457 problem+json for errors. So this envelope is success-only, `error` would
 * be permanently false, and it is omitted rather than shipped as a field that never
 * varies.
 */
export class ResultObjectDto<T> {
  @ApiProperty({ example: 200 })
  htmlcode: number;

  @ApiProperty({ nullable: true })
  object: T | null;

  @ApiProperty({ type: [MessageDto] })
  messages: MessageDto[];

  constructor(object: T | null, htmlcode = 200, messages: MessageDto[] = []) {
    this.object = object;
    this.htmlcode = htmlcode;
    this.messages = messages;
  }
}
