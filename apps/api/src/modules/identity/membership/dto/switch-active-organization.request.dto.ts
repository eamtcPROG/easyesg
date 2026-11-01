import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * UC-16's switch (FR-12; task 83.1): the organization, and only the organization.
 *
 * The account and the session are the authenticated request's and have no field here — a session id
 * in the body would let a caller name which session to move, and an account id would make the route
 * an answer about somebody else. No custom `message`, as every request DTO here: field-level
 * validation output is addressed to the developer integrating against the api.
 */
export class SwitchActiveOrganizationRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The organization this session acts for from its next request on — one the signed-in ' +
      'account is an active member of, as `GET /memberships` lists them. Choosing the ' +
      'organization already active is permitted and changes nothing.',
  })
  @IsUUID()
  organizationId!: string;
}
