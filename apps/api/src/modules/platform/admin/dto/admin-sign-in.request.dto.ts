import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/admin/session` (FR-75, UC-68; task 23).
 *
 * `@IsEmail` is a statement about the request's shape, not about whether an operator exists
 * (`SignInRequestDto`'s note) — and the code is `@IsString` only: its six-digit shape is the
 * verifier's business, so a malformed code answers `factor-invalid` like a wrong one rather
 * than leaking "you got the password right" through a 400.
 */
export class AdminSignInRequestDto {
  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    description: 'Verified against the elevated credential; failures are uniform and throttled.',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    description:
      'The current TOTP code (FR-75 — the second factor is mandatory, without exception).',
    example: '287082',
  })
  @IsString()
  totpCode!: string;
}
