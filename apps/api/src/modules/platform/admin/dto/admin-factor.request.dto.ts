import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/admin/session` — UC-68 step two (FR-75; the handshake, 24 Aug 2026).
 * The challenge itself rides the sealed httpOnly cookie step one set, never the body; the code
 * is `@IsString` only, because its six-digit shape is the verifier's business and a malformed
 * code answers `factor-invalid` like a wrong one.
 */
export class AdminFactorRequestDto {
  @ApiProperty({
    description:
      'The current TOTP code (FR-75 — the second factor is mandatory, without exception).',
    example: '287082',
  })
  @IsString()
  totpCode!: string;
}
