import { ApiProperty } from '@nestjs/swagger';
import type { LegalController } from '../domain/legal-controller';

/**
 * `GET /api/v1/legal/controller` (task 75; FR-205): the operator the terms of service and the privacy notice name,
 * each fact as registered. A Platform Administrator edits them on A-21; the documents' text, and its version, are the
 * release's (182/116).
 */
export class LegalControllerResponseDto {
  @ApiProperty({ example: 'EasyESG SRL', description: 'The operator’s name as registered.' })
  readonly registeredName: string;

  @ApiProperty({ example: '1099600012345', description: 'The operator’s IDNO — 13 digits, the last a check digit.' })
  readonly idno: string;

  @ApiProperty({ description: 'The operator’s registered address, as registered.' })
  readonly registeredAddress: string;

  @ApiProperty({ format: 'email', description: 'Where questions about personal data are sent.' })
  readonly dataProtectionEmail: string;

  constructor(controller: LegalController) {
    this.registeredName = controller.registeredName;
    this.idno = controller.idno;
    this.registeredAddress = controller.registeredAddress;
    this.dataProtectionEmail = controller.dataProtectionEmail;
  }
}
