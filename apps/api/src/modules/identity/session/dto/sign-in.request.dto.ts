import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/session` (FR-4, UC-04).
 *
 * Shape here, policy in the use case — `RegisterAccountRequestDto` carries the full argument.
 * One addition specific to sign-in: `@IsEmail` on a sign-in body is a statement about the
 * REQUEST (malformed input, 400), not about whether an account exists, so it does not breach
 * NFR-64's uniformity — no well-formed address is refused by shape.
 */
export class SignInRequestDto {
  @ApiProperty({
    format: 'email',
    example: 'ana.popescu@example.md',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    description: 'Verified against the stored credential; failures are uniform and rate-limited.',
  })
  @IsString()
  password!: string;
}
