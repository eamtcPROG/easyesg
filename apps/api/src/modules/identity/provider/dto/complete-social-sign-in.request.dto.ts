import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  SOCIAL_SIGN_IN_INTENT,
  type SocialSignInIntent,
} from '../models/provider-identity.model';

/**
 * `POST /api/v1/auth/social/{provider}/session` (FR-2, FR-4; UC-02, UC-05; task 24).
 *
 * The callback's `code` plus everything the challenge told the caller to hold: `state`, `nonce`
 * and the PKCE verifier travel back from the web tier's sealed transaction cookie, and the
 * `redirectUri` must be the one the flow began with — the token endpoint enforces that
 * equality, so a drifted value fails the exchange rather than anything here.
 */
export class CompleteSocialSignInRequestDto {
  @ApiProperty({ description: "The authorization code from the provider's callback." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  code!: string;

  @ApiProperty({ description: 'The state the challenge issued, as returned by the callback.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  state!: string;

  @ApiProperty({ description: 'The nonce the challenge issued.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  nonce!: string;

  @ApiProperty({ description: 'The PKCE verifier the challenge issued.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  codeVerifier!: string;

  @ApiProperty({
    description: 'The redirect URI the flow began with — must match the challenge exactly.',
    example: 'http://localhost:3100/auth/social/google/callback',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  redirectUri!: string;

  @ApiProperty({
    enum: Object.values(SOCIAL_SIGN_IN_INTENT),
    description:
      'What the user was doing when the flow began. A sign-in that matches no account is ' +
      'offered registration rather than silently given one; a registration that matches an ' +
      'existing address is refused rather than linked.',
  })
  @IsIn(Object.values(SOCIAL_SIGN_IN_INTENT))
  intent!: SocialSignInIntent;
}
