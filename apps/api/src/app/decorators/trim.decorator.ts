import { Transform } from 'class-transformer';

/**
 * Trims a string property **before** the validators run (task 29.1's review).
 *
 * **It has to be a transform rather than a `.trim()` in the use case, and that ordering is the
 * whole point.** `@Length(1, 200)` measures whatever reaches it, so a name of three spaces passes —
 * and a use case trimming afterwards then stores the empty string the validator was written to
 * refuse. `core.organization.name` is `text NOT NULL`, which accepts `''` happily, so the row is
 * created with a blank name and every surface that renders an organization by name shows an
 * unidentifiable row. Measured against the live schema before this decorator existed.
 *
 * `ValidationPipe` runs with `transform: true`, so `@Transform` is applied during
 * `plainToInstance` — before validation — which is what makes the length check meaningful.
 *
 * **Non-strings pass through untouched.** A client sending `name: 42` must still be refused by
 * `@IsString()` with its own message, not by a `TypeError` in a transform.
 *
 * `null` passes through too, so it keeps meaning "clear this field" on a patch. That distinction
 * belongs to the DTO's `@ValidateIf`, and a transform coercing `null` to `''` would quietly turn a
 * deliberate clear into an empty string.
 */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
