import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** `POST /api/v1/auth/password-reset-email` (FR-6, UC-08). Mirrors the verification resend. */
export class RequestPasswordResetRequestDto {
  @ApiProperty({
    format: 'email',
    example: 'ana.popescu@example.md',
    description: 'Malformed addresses are refused as requests; well-formed ones are never.',
  })
  @IsEmail()
  email!: string;
}
