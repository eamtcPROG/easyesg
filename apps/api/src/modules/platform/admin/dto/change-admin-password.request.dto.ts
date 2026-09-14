import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * `POST /api/v1/admin/credentials/password` (task 144; UC-212) — the tenant `ChangePasswordRequestDto`'s
 * shape over the admin realm. Shape here, policy in the use case (OQ-51). **No `default:` on the election**:
 * openapi-typescript would emit it required (`contract-shape.spec.ts`), so the default is stated in the
 * description and applied in the use case.
 */
export class ChangeAdminPasswordRequestDto {
  @ApiProperty({
    format: 'password',
    description: 'The password in force now. A change without the correct one is refused.',
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    description:
      'The replacement, under the same policy as every password: minimum 8 and maximum 128 characters, ' +
      'with at least one lowercase letter, one uppercase letter, one digit and one further character.',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    required: false,
    description:
      'End the operator’s **other** active sessions. Opt-in, and false when omitted; the session making ' +
      'this request is never one of them.',
  })
  @IsOptional()
  @IsBoolean()
  terminateOtherSessions?: boolean;
}
