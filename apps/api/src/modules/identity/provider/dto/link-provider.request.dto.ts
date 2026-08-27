import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** The redirect URI's bound, matching `SocialChallengeRequestDto`'s. */
const URI_MAX_LENGTH = 2048;

/**
 * `POST /api/v1/account/providers/{provider}` — UC-11's completion (FR-8; task 27.6).
 *
 * **The OAuth half is `CompleteSocialSignInRequestDto`'s, minus `intent`.** The intent existed
 * there to choose between signing in and registering; reaching *this* route is itself the
 * statement that the flow was a link, so carrying it as data as well would let the two disagree.
 * Everything else — code, state, nonce, verifier, redirect URI — is the same transaction the web
 * tier sealed when the flow began.
 */
export class LinkProviderRequestDto {
  @ApiProperty({ description: 'The authorization code returned by the provider.' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'The `state` from the sealed transaction, echoed by the provider.' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ description: 'The `nonce` from the sealed transaction, checked in the ID token.' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiProperty({ description: 'The PKCE verifier from the sealed transaction.' })
  @IsString()
  @IsNotEmpty()
  codeVerifier!: string;

  @ApiProperty({
    description: 'The redirect URI the code was issued against — checked against the allowlist.',
    example: 'http://localhost:3100/auth/social/google/callback',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(URI_MAX_LENGTH)
  redirectUri!: string;

  @ApiPropertyOptional({
    format: 'password',
    description:
      'The account’s current password. Required for every account that has one — a link adds a ' +
      'way in, so a stolen session must not be able to attach a provider (§12.5.6). Omitted only ' +
      'by an account that signs in through a provider and holds no password.',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

/** `DELETE`-shaped bodies are awkward through proxies, so unlink is `POST .../removal`. */
export class UnlinkProviderRequestDto {
  @ApiPropertyOptional({
    format: 'password',
    description:
      'The account’s current password, on the same rule as linking: an attacker on a stolen ' +
      'session must not be able to strip the owner’s other provider.',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
