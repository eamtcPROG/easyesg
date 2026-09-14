import { ApiProperty } from '@nestjs/swagger';
import { formatRecoveryCode } from '@api/modules/identity/account/domain/recovery-code';

/**
 * A-19's new set of recovery codes (task 144) — the only moment they exist outside the operator's keeping.
 * Grouped here, as the tenant `RecoveryCodesResponseDto` groups them, so every surface prints them alike and
 * the server's normalisation accepts what it printed.
 */
export class AdminRecoveryCodesResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'Ten single-use codes, shown exactly once. Every code of an earlier set stopped working when these ' +
      'were issued.',
    example: ['0123-4567-89AB-CDEF'],
  })
  readonly recoveryCodes: string[];

  constructor(codes: readonly string[]) {
    this.recoveryCodes = codes.map(formatRecoveryCode);
  }
}
