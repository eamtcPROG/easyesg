import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/admin/session/recovery` (task 144; UC-212) — the address, the password and one recovery
 * code in one request. `@IsEmail` states the request's shape, not whether an operator exists
 * (`AdminChallengeRequestDto`'s note); the code is `@IsString` only, because a malformed code and a wrong one
 * must be one refusal.
 */
export class AdminRecoveryRequestDto {
  @ApiProperty({ format: 'email', example: 'operator@easyesg.md' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'password', description: 'The operator’s password.' })
  @IsString()
  password!: string;

  @ApiProperty({
    description:
      'One unused recovery code, as printed or retyped — hyphens and letter case do not matter.',
    example: '0123-4567-89AB-CDEF',
  })
  @IsString()
  recoveryCode!: string;
}
