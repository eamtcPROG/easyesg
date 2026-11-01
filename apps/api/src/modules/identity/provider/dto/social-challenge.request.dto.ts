import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * `POST /api/v1/auth/social/{provider}/challenge` (FR-2, FR-4; task 24).
 *
 * The redirect URI is a parameter rather than server-side state because the api is stateless
 * across the OAuth redirect (§12.5.6's task-24 flow row): the caller names where the provider
 * should send the browser back, and the provider's configured allowlist — A-18's redirect
 * configuration — decides whether that is allowed. `@MaxLength` bounds the echo, not the check.
 */
export class SocialChallengeRequestDto {
  @ApiProperty({
    description:
      'Where the provider returns the browser. Must match the redirect configuration ' +
      'registered for the provider exactly.',
    example: 'http://localhost:3100/auth/social/google/callback',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  redirectUri!: string;
}
