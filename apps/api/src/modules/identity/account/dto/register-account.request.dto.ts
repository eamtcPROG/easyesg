import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

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
}
