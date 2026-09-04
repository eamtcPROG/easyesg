import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * `POST /api/v1/auth/session` (FR-4, UC-04).
 *
 * Shape here, policy in the use case — `RegisterAccountRequestDto` carries the full argument.
 * One addition specific to sign-in: `@IsEmail` on a sign-in body is a statement about the
 * REQUEST (malformed input, 400), not about whether an account exists, so it does not breach
 * NFR-64's uniformity — no well-formed address is refused by shape.
 */
export class SignInRequestDto {
  @ApiProperty({
    format: 'email',
    example: 'ana.popescu@example.md',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    description: 'Verified against the stored credential; failures are uniform and rate-limited.',
  })
  @IsString()
  password!: string;

  /**
   * S-01's *Keep me signed in on this device* (§12.5.6, OQ-35 amended 4 Sep 2026).
   *
   * **Optional, and absent means `false`** — the shorter of the two lifetime pairs. That direction
   * is deliberate: a client that has not been updated, or one that drops the field, gets the safer
   * session rather than the longer one, and the only cost of being wrong is a sign-in.
   *
   * The choice is made once. It is written to the session row at creation, the migration grants no
   * `UPDATE` on it, and where a second factor is enrolled it rides the sealed challenge rather than
   * being asked again — so no later request can widen a window already granted.
   */
  /*
   * **No `default:` in the schema, deliberately.** openapi-typescript treats a property carrying a
   * default as always present and emits `remember: boolean` rather than `remember?: boolean` — so
   * the generated client would oblige every caller to send a field the spec's own `required` list
   * omits. The default is stated in the description, where a reader needs it, and enforced in the
   * use case (`command.remember ?? false`), which is the only place it can actually be applied.
   */
  @ApiPropertyOptional({
    description:
      'Whether the session persists on this device. Absent or false grants the shorter lifetime.',
  })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
