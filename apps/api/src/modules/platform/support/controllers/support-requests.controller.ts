import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AdmitsVisitor } from '@api/modules/identity/session/decorators/admits-visitor.decorator';
import { SubmitSupportRequestDto, SupportRequestReceiptDto } from '../dto/support-request.dto';
import { SupportRequestService } from '../services/support-request.service';

/**
 * `/api/v1/support/requests` — UC-182, a request to support (task 77; FR-212; `architecture.md` §12.5.6's task-77 row).
 *
 * **`@AdmitsVisitor`, not `@Public()`**: a visitor writes with no session, and a signed-in reader's request names their
 * account and organization, so the route must read a bearer when one comes — the cookie banner's reason (task 223).
 *
 * **Rationed per sender in the use case** (row (6)), not by the address a request came from, which is the web
 * server's for every reader and the proxy's until task 71. **No entitlement key**: a visitor has no organization.
 */
@ApiTags('support')
@Controller('support/requests')
@AdmitsVisitor()
export class SupportRequestsController {
  constructor(private readonly requests: SupportRequestService) {}

  @Post()
  @ApiOperation({
    summary: 'Write to support',
    description:
      'UC-182. The question is recorded with a reference the reader quotes, and delivered to the support address; ' +
      'support replies by email, quoting the reference. A signed-in reader is not asked their name or address — the ' +
      'account’s, and the active organization’s name, travel with the request. A visitor gives both.',
  })
  @ApiObjectResponse(SupportRequestReceiptDto, { status: 201, description: 'The request as recorded: its reference.' })
  @ApiResponse({
    status: 400,
    description: 'A field missing or over its length, or a visitor who gave no name or address (validation-failed).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 429,
    description: 'A sixth request from one sender within fifteen minutes (rate-limited); nothing was recorded.',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 503,
    description: 'No support address is in force (support-channel-unavailable); nothing was recorded.',
    content: { 'application/problem+json': {} },
  })
  async submit(@Body() body: SubmitSupportRequestDto): Promise<SupportRequestReceiptDto> {
    return new SupportRequestReceiptDto(
      await this.requests.submit({
        topic: body.topic,
        question: body.question,
        replyLocale: body.replyLocale,
        visitor: {
          ...(body.name === undefined ? {} : { name: body.name }),
          ...(body.email === undefined ? {} : { email: body.email }),
        },
      }),
    );
  }
}
