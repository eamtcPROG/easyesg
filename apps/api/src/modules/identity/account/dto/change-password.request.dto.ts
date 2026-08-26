import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * `POST /api/v1/account/password` (FR-7, UC-10). Shape here, policy in the use case — the password
 * rule lives in `domain/password-policy.ts`, for `RegisterAccountRequestDto`'s reasons.
 *
 * The two password fields are adjacent and both `string`, which is the swap hazard CLAUDE.md names
 * — and the mitigation is that this is a DTO, so they are matched by **name** off the JSON body and
 * cannot be transposed by a caller the way positional arguments can. The use-case command keeps
 * the same names for the same reason.
 */
export class ChangePasswordRequestDto {
  @ApiProperty({
    format: 'password',
    description: 'The password in force now. A change without the correct one is refused (FR-7).',
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    description:
      'The replacement, under the same policy as registration: minimum 8 and maximum 128 ' +
      'characters, with at least one lowercase letter, one uppercase letter, one digit and one ' +
      'further character.',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'End the account’s **other** active sessions. Opt-in, because FR-7 says *where the user ' +
      'elects it* — and the session making this request is never one of them, so the device the ' +
      'change was made from keeps working.',
  })
  @IsOptional()
  @IsBoolean()
  terminateOtherSessions?: boolean;
}
