import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AdmitsVisitor } from '@api/modules/identity/session/decorators/admits-visitor.decorator';
import { CookieChoiceResponseDto, RecordCookieChoiceRequestDto } from '../dto/cookie-choice.dto';
import { CookieChoiceService } from '../services/cookie-choice.service';

/**
 * `/api/v1/legal/cookie-choices` — the cookie banner's answer, recorded (task 223; FR-206; `design_spec.md` S-31,
 * OQ-27; §12.5.6's task-223 row (6)).
 *
 * **`@AdmitsVisitor`, not `@Public()`**: a visitor answers with no session, and a member's answer names their account,
 * so the route must read a bearer when one comes — which a public route never does.
 *
 * **Not throttled here, and that is a recorded gap rather than an oversight** (row (7)): the web calls this from its own
 * server, so every visitor arrives from one address and an application throttle keyed on it would refuse the whole
 * site at once. Task 71's per-address budget at the edge is what bounds it.
 */
@ApiTags('platform')
@Controller('legal/cookie-choices')
@AdmitsVisitor()
export class CookieChoicesController {
  constructor(private readonly choices: CookieChoiceService) {}

  @Post()
  @ApiOperation({
    summary: 'Record an answer to the cookie banner',
    description:
      'UC-179. The reader was told what the site sets, under this version of the cookie policy — by the signed-in ' +
      'account when a session is presented, by nobody when none is. Every cookie the site sets is strictly necessary, ' +
      'so there is one answer and the body carries no choice. The record is kept twelve months.',
  })
  @ApiObjectResponse(CookieChoiceResponseDto, { status: 201, description: 'The answer as recorded.' })
  @ApiResponse({
    status: 409,
    description:
      'The version is not the cookie policy in force (problem type legal-version-changed); nothing was recorded.',
    content: { 'application/problem+json': {} },
  })
  async record(@Body() body: RecordCookieChoiceRequestDto): Promise<CookieChoiceResponseDto> {
    return new CookieChoiceResponseDto(await this.choices.record(body));
  }
}
