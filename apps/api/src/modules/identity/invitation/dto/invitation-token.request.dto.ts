import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * The body of both bearer routes — preview and acceptance (UC-15, task 26.2).
 *
 * **The token travels in a POST body, never in the URL**, which is the shape all three token kinds
 * use (`/auth/verify-email`, `/auth/password-reset`). Two reasons, and the second is the one that
 * decided it: a path segment lands in every access log, proxy trace and `Referer` header along the
 * way; and a `GET` that could consume an invitation would be spent by the first mail scanner that
 * follows the link. The preview here consumes nothing, but keeping both routes one shape means
 * nobody has to remember which is which.
 *
 * The length bounds are the token's own: 32 bytes of base64url is 43 characters unpadded. Bounding
 * it is not ceremony — this is an unauthenticated route on the preview side, and an unbounded string
 * reaching a SHA-256 is free work for anyone who asks.
 */
export class InvitationTokenRequestDto {
  @ApiProperty({
    description:
      'The single-use token from the invitation email. Sent in the body rather than the URL so it ' +
      'stays out of access logs and referrer headers.',
    minLength: 43,
    maxLength: 43,
  })
  @IsString()
  @MinLength(43)
  @MaxLength(43)
  token!: string;
}
