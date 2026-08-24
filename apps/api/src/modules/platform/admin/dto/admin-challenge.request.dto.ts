import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/admin/session/challenge` — UC-68 step one (FR-75; the handshake,
 * 24 Aug 2026). `@IsEmail` is a statement about the request's shape, not about whether an
 * operator exists (`SignInRequestDto`'s note).
 */
export class AdminChallengeRequestDto {
  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    description: 'Verified against the elevated credential; failures are uniform and throttled.',
  })
  @IsString()
  password!: string;
}
