/**
 * Password hashing, behind a port (§9.1, P-7).
 *
 * The port exists so the use case can be tested with no native binding and no 19 MiB of memory
 * per call, and so §9.1's algorithm choice is stated in exactly one place. It is not a hedge
 * against replacing Argon2id — §9.1 closed that.
 *
 * `verify` is unused at task 19 and is declared anyway, which is the one place this file bends
 * ISP deliberately: hashing and verifying are one capability seen from two ends, they must agree
 * on parameters and pepper, and splitting them would invite a second implementation of half of it
 * when task 21 adds sign-in.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(digest: string, password: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
