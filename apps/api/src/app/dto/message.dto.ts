import { ApiProperty } from '@nestjs/swagger';

/**
 * Message severity carried on a SUCCESSFUL response.
 *
 * There is deliberately no ERROR member. Errors never travel in the envelope — they leave
 * through ProblemDetailsFilter as RFC 9457 `application/problem+json` (architecture.md §6.8,
 * which is closed on this). A message here is something the caller should read while still
 * having got what they asked for.
 *
 * WARNING is what carries AD-5's `allow_with_warning` decision to the client, and what NFR-79's
 * three-part message (what happened / so what / what now) rides on.
 */
export enum MessageType {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
}

/**
 * A message on the envelope, carrying both a stable identity and its rendered text.
 *
 * **Amended 19 Aug 2026 (architecture.md OQ-46).** §6.8 said this "holds message keys resolved
 * through platform/localization" — readable either as *the wire carries keys* or as *the values
 * come from keys rather than hardcoded sentences*. OQ-46 settled it: the API resolves wording
 * server-side against the locale negotiated from `Accept-Language`, so `text` is what a caller
 * displays.
 *
 * `key` stays, and is not redundant. It is the machine-readable discriminator — the same role
 * `type` plays in a problem document — so a client can special-case `entitlement.quota.approaching`
 * without matching on a sentence that a copy edit will change. It is not user-facing text and
 * must never be displayed.
 *
 * There is no `params` member: placeholders are interpolated into `text` before it leaves, so a
 * second copy of the inputs would only be an invitation to re-render them differently.
 */
export class MessageDto {
  @ApiProperty({ enum: MessageType })
  type: MessageType;

  /**
   * Stable identity for programmatic handling. Never rendered — CLAUDE.md forbids an internal
   * identifier reaching a surface a person reads.
   */
  @ApiProperty({ example: 'entitlement.quota.approaching' })
  key: string;

  /**
   * The rendered message in the negotiated locale, carrying NFR-79's three parts. Absent when
   * the catalogue has no entry for the key, so a caller shows nothing rather than an identifier.
   */
  @ApiProperty({ required: false })
  text?: string;

  constructor(key: string, text?: string, type: MessageType = MessageType.SUCCESS) {
    this.key = key;
    this.text = text;
    this.type = type;
  }
}
