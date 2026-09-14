import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * `POST /api/v1/admin/credentials/totp/confirmation` (task 144) — **the current password as well as the
 * code** (§12.5.6's task-144 row), so a stolen session alone never completes a re-enrolment. The code is
 * `@IsString` only, A-20's reading: a malformed code and a wrong one get the same refusal.
 */
export class ConfirmAdminReenrolmentRequestDto {
  @ApiProperty({ format: 'password', description: 'The operator’s current password.' })
  @IsString()
  password!: string;

  @ApiProperty({
    description: 'A current code from the authenticator the staged secret was entered into.',
    example: '287082',
  })
  @IsString()
  code!: string;
}
