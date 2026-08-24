import { ApiProperty } from '@nestjs/swagger';
import type { ProviderAuthorizationChallenge } from '@api/contracts/identity-provider.port';

/**
 * The authorization challenge (task 24): the URL to send the browser to, and the three values
 * binding the eventual callback to this request. The caller — the web tier — must hold
 * `state`, `nonce` and `codeVerifier` across the redirect in a sealed httpOnly cookie and
 * present them to the session endpoint; they never reach the browser readable (§12.5.6's
 * task-24 flow row).
 */
export class SocialChallengeResponseDto {
  @ApiProperty({
    description: "The provider's authorization endpoint with this flow's parameters applied.",
  })
  readonly authorizationUrl: string;

  @ApiProperty({
    description: 'Binds the callback to this challenge. Compare against the callback query.',
  })
  readonly state: string;

  @ApiProperty({
    description: 'Required by the completion endpoint; validated against the ID token.',
  })
  readonly nonce: string;

  @ApiProperty({
    description: 'The PKCE verifier the completion endpoint presents to the token endpoint.',
  })
  readonly codeVerifier: string;

  constructor(challenge: ProviderAuthorizationChallenge) {
    this.authorizationUrl = challenge.authorizationUrl;
    this.state = challenge.state;
    this.nonce = challenge.nonce;
    this.codeVerifier = challenge.codeVerifier;
  }
}
