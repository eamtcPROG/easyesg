import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';

/**
 * Argon2id behind `PasswordHasher` (§9.1, §12.1, §14.1).
 *
 * §9.1 closed the algorithm and the pepper and named no parameters, so these are OWASP's first
 * recommended Argon2id configuration — **m = 19456 KiB (19 MiB), t = 2, p = 1** — recorded here
 * with that provenance rather than left as whatever the library defaults to on the day. They are a
 * cost decision as much as a security one: at `poolSize` 10 and ~150 peak concurrent sessions
 * (§16), 19 MiB per in-flight hash is what makes hashing outside the transaction matter, which is
 * why `RegisterAccount` does it before opening one.
 *
 * **Moving them is a schema-free migration, not an edit.** An existing digest encodes the
 * parameters it was produced with, so `verify` keeps working across a change; new hashes simply
 * use the new cost. What must never change silently is the pepper — every digest produced with it
 * becomes unverifiable without it, which is why it is required rather than defaulted.
 *
 * The `$argon2id$` prefix and the `secret` option are both pinned by `argon2-binding.spec.ts`,
 * which exists because a missing platform prebuild surfaces at require time rather than at install
 * time — and because the library's `Algorithm` enum is ambient and unusable under
 * `isolatedModules`, so §9.1's algorithm rests on the documented default being what it says.
 */
const MEMORY_COST_KIB = 19_456;
const TIME_COST = 2;
const PARALLELISM = 1;

export class Argon2PasswordHasher implements PasswordHasher {
  private readonly secret: Buffer;

  constructor(pepper: string | undefined) {
    if (!pepper) {
      // Thrown at construction, which is boot — not at the first registration attempt, and not as
      // a silently weaker hash. `emit-openapi.ts` runs in preview mode and instantiates no
      // provider, so this does not cost the hermetic gates a secret.
      throw new Error(
        'AUTH_PASSWORD_PEPPER is not set. architecture.md §9.1 requires a pepper from the secret ' +
          'manager alongside Argon2id; a digest produced without it is not the one §9.1 specifies.',
      );
    }
    this.secret = Buffer.from(pepper, 'utf8');
  }

  hash(password: string): Promise<string> {
    return hash(password, {
      secret: this.secret,
      memoryCost: MEMORY_COST_KIB,
      timeCost: TIME_COST,
      parallelism: PARALLELISM,
    });
  }

  /**
   * Returns false rather than throwing on a malformed digest. Task 21's sign-in must answer "no"
   * for a corrupt stored hash exactly as it does for a wrong password — a 500 there is an oracle
   * that says the account exists and its record is unusual.
   */
  async verify(digest: string, password: string): Promise<boolean> {
    try {
      return await verify(digest, password, { secret: this.secret });
    } catch {
      return false;
    }
  }
}
