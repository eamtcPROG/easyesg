import { ApiProperty } from '@nestjs/swagger';

/**
 * Message severity carried on a SUCCESSFUL response.
 *
 * There is deliberately no ERROR member. Errors never travel in the envelope —
 * they leave through ProblemDetailsFilter as RFC 9457 `application/problem+json`
 * (architecture.md §6.8, which is closed on this). A message here is something the
 * caller should read while still having got what they asked for.
 *
 * WARNING is what carries AD-5's `allow_with_warning` decision to the client, and
 * what NFR-79's three-part message (what happened / so what / what now) rides on.
 */
export enum MessageType {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
}

export class MessageDto {
  @ApiProperty({ enum: MessageType })
  type: MessageType;

  /**
   * A message KEY, not a sentence. Resolved through platform/localization against
   * the configuration store, because FR-61/FR-62 require user-facing wording to be
   * publishable within one working day and revertible in one step (NFR-85). A literal
   * string here would be an AD-4 violation — it would need a release to change.
   */
  @ApiProperty({ example: 'entitlement.quota.approaching' })
  key: string;

  @ApiProperty({ required: false, type: Object })
  params?: Record<string, unknown>;

  constructor(key: string, type: MessageType = MessageType.SUCCESS, params?: Record<string, unknown>) {
    this.key = key;
    this.type = type;
    this.params = params;
  }
}
