import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /api/v1/auth/account-setup/password` (task 155; UC-03's link path to S-36). The grant's bounds
 * are the token's own — 32 bytes of base64url is 43 characters unpadded — and they bound work on a
 * public route rather than validating the grant, which only the database can do.
 */
export class SetFirstPasswordByGrantRequestDto {
  @ApiProperty({
    minLength: 43,
    maxLength: 43,
    description:
      'The single-use grant the address confirmation answered with. It lasts 15 minutes from the ' +
      'confirmation.',
  })
  @IsString()
  @MinLength(43)
  @MaxLength(43)
  grant!: string;

  @ApiProperty({
    format: 'password',
    description:
      'The account’s first password, under the same policy as registration: minimum 8 and maximum 128 ' +
      'characters, with at least one lowercase letter, one uppercase letter, one digit and one further ' +
      'character.',
  })
  @IsString()
  password!: string;

  /*
   * S-01's *Keep me signed in on this device*, asked on this step because it signs the person in
   * (§12.5.6's task-155 row (4)). `SignInRequestDto.remember`'s shape for its reasons: optional, absent
   * reads as `false`, and no `default:` in the schema, so the generated client keeps the field optional
   * and the use case applies `remember ?? false`.
   */
  @ApiPropertyOptional({
    description:
      'Whether the session persists on this device. Absent or false grants the shorter lifetime.',
  })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
