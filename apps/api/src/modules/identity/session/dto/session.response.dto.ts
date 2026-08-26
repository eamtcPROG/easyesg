import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { EpochMillis } from '@api/contracts/types/time';
import { SIGN_IN_OUTCOME, type IssuedSession } from '../models/session.model';

/**
 * The identity block a session response carries — deliberately three fields, each with a caller
 * that needs it at exactly this moment: `id` keys client caches, `email` is the "signed in as"
 * line, and `locale` is what the web tier writes into `NEXT_LOCALE` at sign-in (OQ-32 — the
 * session is named there as what carries the profile preference to the cookie). Everything else
 * about the account is the profile surface's, fetched authenticated.
 */
export class SessionAccountDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'email', example: 'ana.popescu@example.md' })
  readonly email: string;

  @ApiProperty({
    enum: [...LOCALES],
    description: 'The interface language persisted on the account (FR-10).',
  })
  readonly locale: Locale;

  constructor(account: IssuedSession['account']) {
    this.id = account.id;
    this.email = account.email;
    this.locale = account.locale;
  }
}

/**
 * A session as it leaves the API — sign-in and refresh answer identically (AD-12: a refreshed
 * session is the same session, rotated).
 *
 * Both expiries are stated rather than left for the client to infer, because the client CANNOT
 * infer them: the refresh expiry is min(idle, absolute) computed server-side (§12.5.6, OQ-35),
 * and a client that assumed "issued + 7 days" would be wrong for every window that crosses the
 * absolute cap. Epoch milliseconds, UTC — the persistence-to-DTO boundary, as everywhere (OQ-50).
 *
 * What is deliberately NOT here: any role, organization or entitlement. AD-12 keeps the session
 * to identity; authorization is read per request server-side, which is what makes FR-58's "next
 * request, not next login" true.
 */
export class SessionResponseDto {
  /**
   * Added by task 27.3, and it changes nothing for an existing consumer: the field is additive,
   * every response that carried a session before carries one still, and `refresh` answers this
   * same shape. What it buys is that a client branches on a discriminator rather than probing for
   * `accessToken` — which is the difference between reading the contract and guessing at it.
   */
  @ApiProperty({
    enum: [SIGN_IN_OUTCOME.SIGNED_IN],
    description:
      'The discriminator sign-in answers with. `challenged` is the other member, and carries a ' +
      'factor challenge instead of a session (UC-194).',
  })
  readonly kind = SIGN_IN_OUTCOME.SIGNED_IN;

  @ApiProperty({
    description:
      'Bearer token for the Authorization header. Signed, short-lived; carries the session ' +
      'identity and no authorization data.',
  })
  readonly accessToken: string;

  @ApiProperty({
    type: 'integer',
    description: 'Unix epoch milliseconds, UTC. At most 15 minutes after issuance.',
    example: 1_787_444_100_000,
  })
  readonly accessTokenExpiresAt: EpochMillis;

  @ApiProperty({
    description:
      'Opaque, single-use. Present it to the refresh endpoint to obtain a successor pair; it is ' +
      'invalidated by that refresh, by sign-out, and by a consumed password reset.',
  })
  readonly refreshToken: string;

  @ApiProperty({
    type: 'integer',
    description:
      'Unix epoch milliseconds, UTC. When this session dies if never refreshed again — the ' +
      'earlier of its idle and absolute bounds.',
    example: 1_788_048_000_000,
  })
  readonly refreshTokenExpiresAt: EpochMillis;

  @ApiProperty({ type: SessionAccountDto })
  readonly account: SessionAccountDto;

  constructor(issued: IssuedSession) {
    this.accessToken = issued.accessToken;
    this.accessTokenExpiresAt = issued.accessTokenExpiresAt.getTime();
    this.refreshToken = issued.refreshToken;
    this.refreshTokenExpiresAt = issued.refreshTokenExpiresAt.getTime();
    this.account = new SessionAccountDto(issued.account);
  }
}

/**
 * What sign-in answers when the account has a second factor (UC-194; task 27.3).
 *
 * **A 200-class answer rather than a problem document**, because nothing failed: the credential
 * was correct and there is one more step. NFR-79's three-part refusal shape has nothing to say
 * about a step proceeding normally, and a `403` here would make every client treat a successful
 * first step as an error.
 *
 * **A separate DTO rather than optional fields on `SessionResponseDto`.** One shape carrying both
 * would make "a challenge with an access token in it" representable in the contract, and the
 * generated client would hand every consumer six optional properties to narrow by hand. Two
 * shapes with a discriminator make the impossible one unrepresentable — the same reason
 * `SignInOutcome` is a union rather than a record with optional halves.
 */
export class FactorChallengeResponseDto {
  @ApiProperty({
    enum: [SIGN_IN_OUTCOME.CHALLENGED],
    description:
      'The discriminator. `signed_in` carries a session; this one carries a challenge, and a ' +
      'client must branch on it rather than probing for a field.',
  })
  readonly kind = SIGN_IN_OUTCOME.CHALLENGED;

  @ApiProperty({
    description:
      'Opaque and sealed — it proves only that this API verified this account’s password just ' +
      'now, and it is not a session and cannot become one. Present it back with the code. The ' +
      'client stores it; where is the client’s decision (the web tier keeps it in a short-lived ' +
      'httpOnly cookie, as it does the OAuth transaction).',
  })
  readonly challenge: string;

  @ApiProperty({
    type: Number,
    description:
      'When the challenge stops being accepted — epoch milliseconds, UTC (OQ-50). Stated rather ' +
      'than left for the client to infer, so a screen can say how long is left without knowing ' +
      'the policy.',
  })
  readonly expiresAt: EpochMillis;

  constructor(challenged: { readonly challenge: string; readonly expiresAt: Date }) {
    this.challenge = challenged.challenge;
    this.expiresAt = challenged.expiresAt.getTime();
  }
}
