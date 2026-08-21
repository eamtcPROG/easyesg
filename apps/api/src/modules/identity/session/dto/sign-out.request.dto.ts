import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** `DELETE /api/v1/auth/session` (FR-5, UC-06). */
export class SignOutRequestDto {
  @ApiProperty({
    description:
      'The refresh token of the session to terminate. Possession is the authentication: it is ' +
      'what the web tier actually holds, and it keeps sign-out working after the access token ' +
      'has already expired.',
  })
  @IsString()
  refreshToken!: string;
}
