import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /api/v1/auth/register` (FR-1, UC-01).
 *
 * **Shape here, policy in the use case.** The address is validated as an address because
 * `class-validator` already has a well-tested implementation of that and nothing in this product
 * needs a second opinion on what an address is. The password is validated only as *a string that is
 * present* — its policy lives in `domain/password-policy.ts` and is applied by `RegisterAccount`.
 *
 * That split is deliberate on both sides. A `@MinLength(8) @Matches(…)` here would be a second copy
 * of the rule the moment anything else evaluates it, and it produces `class-validator`'s `errors`
 * array — which `ProblemDetailsFilter` passes through untranslated because that surface is
 * addressed to a developer integrating against the API. A password that fails policy is read by an
 * SME owner in Romanian or Russian, and NFR-79 requires it to say what failed, what follows and
 * what to do. So it leaves as a problem document with a resolved `detail`, not as a field error.
 *
 * No `@MaxLength` either: the ceiling is policy (128 code points) and belongs with the rest of it.
 * Express's own body limit is what bounds an absurd payload before any of this runs.
 *
 * No display name, and that is UC-01 rather than an omission — it supplies an address and a
 * password. FR-9's profile is task 25's.
 */
export class RegisterAccountRequestDto {
  @ApiProperty({
    format: 'email',
    example: 'ana.popescu@example.md',
    description: 'Case is preserved as supplied; uniqueness is case-insensitive.',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    description:
      'Minimum 8 and maximum 128 characters, with at least one lowercase letter, one uppercase ' +
      'letter, one digit and one further character. Letters are matched by Unicode property, so ' +
      'Romanian and Russian letters count as letters.',
  })
  @IsString()
  password!: string;

  /**
   * S-03's "create an account by password" path (UC-15 step 2), and optional everywhere else.
   *
   * `@IsOptional` rather than a required field with a nullable type: a registration that never saw
   * an invitation must not have to say so. The length bounds are the token's own — 32 bytes of
   * base64url is 43 characters unpadded — and they bound work on an unauthenticated route rather
   * than validating the token, which only the database can do.
   *
   * **A bad token never fails the registration.** Spent, revoked, lapsed, for another address, or
   * simply wrong: the account is created unverified and the ordinary challenge is sent. A stale
   * link is a poor reason to refuse someone an account, and the verification email is a working way
   * forward — so this field can only ever *remove* a step, never add a failure.
   */
  @ApiProperty({
    required: false,
    minLength: 43,
    maxLength: 43,
    description:
      'An organization invitation being acted on. When it is still usable and was sent to this ' +
      'same address, the account is created already confirmed and no confirmation email is sent — ' +
      'the invitation link is itself proof the address was reached. Anything else is ignored and ' +
      'registration proceeds normally.',
  })
  @IsOptional()
  @IsString()
  @MinLength(43)
  @MaxLength(43)
  invitationToken?: string;
}
