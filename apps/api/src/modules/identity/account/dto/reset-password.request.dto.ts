import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/password-reset` (FR-6, UC-09). Shape here, policy in the use case — the
 * password rule lives in `domain/password-policy.ts`, for `RegisterAccountRequestDto`'s reasons.
 */
export class ResetPasswordRequestDto {
  @ApiProperty({ description: 'The single-use value from the reset link.' })
  @IsString()
  token!: string;

  @ApiProperty({
    format: 'password',
    description:
      'The replacement password, under the same policy as registration: minimum 8 and maximum ' +
      '128 characters, with at least one lowercase letter, one uppercase letter, one digit and ' +
      'one further character.',
  })
  @IsString()
  password!: string;
}
