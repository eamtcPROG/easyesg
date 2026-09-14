import { ApiProperty } from '@nestjs/swagger';
import type { OrganizationSupportAccess } from '../models/support-access-request.model';
import { SupportAccessRequestResponseDto } from './support-access-request.response.dto';

/**
 * What the organization is shown about support access (task 67.9; UX-124) — the banner's whole read.
 */
export class OrganizationSupportAccessResponseDto {
  @ApiProperty({
    type: [SupportAccessRequestResponseDto],
    description:
      'Requests waiting for an answer, newest first — for an Organization Administrator, who answers them; ' +
      'empty for any other member.',
  })
  readonly awaiting: SupportAccessRequestResponseDto[];

  @ApiProperty({
    type: SupportAccessRequestResponseDto,
    nullable: true,
    description: 'Access running now, which every member is shown; null when none is.',
  })
  readonly active: SupportAccessRequestResponseDto | null;

  constructor(shown: OrganizationSupportAccess) {
    this.awaiting = shown.awaiting.map((request) => new SupportAccessRequestResponseDto(request));
    this.active = shown.active === null ? null : new SupportAccessRequestResponseDto(shown.active);
  }
}
